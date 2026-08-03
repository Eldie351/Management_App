import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { MovementType, UserRole } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async createSale(userId: number, dto: CreateSaleDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Le panier ne peut pas être vide.');
    }

    // 1. Récupérer l'utilisateur pour vérifier son magasin d'affectation et son rôle
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, assignedStoreId: true },
    });

    if (!currentUser) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    // Sécurité : Un caissier ou manager ne peut vendre QUE dans son magasin assigné
    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.assignedStoreId !== dto.storeId
    ) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à effectuer une vente dans ce magasin.",
      );
    }

    // Transaction atomique : tout réussit ou tout est annulé
    return await this.prisma.$transaction(async (tx) => {
      // 2. Récupération groupée des produits en base de données
      const productIds = dto.items.map((item) => item.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      let calculatedTotalAmount = 0;

      // Déclaration explicite du type pour éviter l'erreur TS 'never[]'
      const verifiedItems: Array<{
        productId: number;
        quantity: number;
        unitPrice: number;
        total: number;
      }> = [];

      // 3. Validation et calcul sécurisé basé sur les données DB
      for (const item of dto.items) {
        const product = productMap.get(item.productId);

        if (!product || product.deletedAt) {
          throw new NotFoundException(
            `Produit ID ${item.productId} introuvable ou archivé.`,
          );
        }

        if (product.storeId !== dto.storeId) {
          throw new BadRequestException(
            `Le produit "${product.name}" n'appartient pas au magasin spécifié.`,
          );
        }

        if (product.quantity < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour "${product.name}". Disponible: ${product.quantity}, Demandé: ${item.quantity}`,
          );
        }

        // Sécurité Prix : On utilise unitPrice défini dans le modèle Prisma
        const itemUnitPrice = Number(product.sellingPrice);
        const itemTotal = itemUnitPrice * item.quantity;
        calculatedTotalAmount += itemTotal;

        verifiedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: itemUnitPrice,
          total: itemTotal,
        });
      }

      // 4. Génération d'un numéro de facture unique sécurisé
      const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
      const invoiceNumber = `FAC-${Date.now()}-${randomSuffix}`;

      // 5. Enregistrement de la vente
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          totalAmount: calculatedTotalAmount,
          paymentMethod: dto.paymentMethod,
          storeId: dto.storeId,
          userId,
          items: {
            create: verifiedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          },
        },
        include: {
          items: {
            include: { product: true },
          },
          user: { select: { id: true, name: true, email: true } },
          store: true,
        },
      });

      // 6. Mise à jour des stocks et enregistrement des mouvements
      for (const item of verifiedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { decrement: item.quantity },
          },
        });

        await tx.stockMovement.create({
          data: {
            quantity: -item.quantity,
            type: MovementType.SALE,
            note: `Vente ${sale.invoiceNumber}`,
            productId: item.productId,
            userId,
            storeId: dto.storeId,
          },
        });
      }

      return sale;
    });
  }

  async findAllByStore(storeId: number) {
    return this.prisma.sale.findMany({
      where: { storeId },
      include: {
        items: { include: { product: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        user: { select: { id: true, name: true, email: true } },
        store: true,
      },
    });

    if (!sale) {
      throw new NotFoundException(`Facture #${id} introuvable.`);
    }

    return sale;
  }
}