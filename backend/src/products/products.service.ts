import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common'; // <-- TOUT EST REGROUPÉ ICI SANS ERREUR
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. AJOUTER UN PRODUIT DANS UN MAGASIN
   */
  async createProduct(dto: CreateProductDto) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const storeExists = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
    });
    if (!storeExists) {
      throw new NotFoundException('Impossible d’ajouter le produit : Magasin introuvable.');
    }

    return this.prisma.product.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        quantity: dto.quantity,
        initialStock: dto.quantity,
        price: dto.price,
        description: dto.description,
        storeId: dto.storeId,
      },
    });
  }

  /**
   * 2. RÉCUPÉRER TOUS LES PRODUITS D'UN MAGASIN SPÉCIFIQUE
   */
  async findAllByStore(storeId: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    // On récupère les produits en incluant leurs ventes associées (via le storeId et le nom/sku)
    const products = await this.prisma.product.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });

    // Pour chaque produit, on cherche ses ventes pour faire la somme
    return Promise.all(
      products.map(async (product) => {
        const sales = await this.prisma.sale.findMany({
          where: { 
            storeId: product.storeId,
            productName: product.name,
          },
        });

        // Somme des quantités vendues
        const totalSold = sales.reduce((acc, sale) => acc + sale.quantity, 0);

        return {
          ...product,
          initialStock: product.quantity + totalSold, // 📌 FORMULE : Quantité actuelle + Quantités vendues
        };
      })
    );
  }

  /**
   * 3. SUPPRIMER UN PRODUIT
   */
  async deleteProduct(id: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');

    await this.prisma.product.delete({ where: { id } });
    return { message: 'Produit supprimé avec succès.' };
  }

  /**
   * 4. DIMINUER LE STOCK LORS D'UNE VENTE
   */
      async sellProduct(id: number, quantityToSell: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');
    if (product.quantity < quantityToSell) {
      throw new BadRequestException(`Stock insuffisant. Unités disponibles : ${product.quantity}`);
    }

    // 1. Diminuer la quantité en stock
    await this.prisma.product.update({
      where: { id },
      data: { quantity: product.quantity - quantityToSell },
    });

    // 2. ENREGISTRER HISTORIQUE DANS POSTGRESQL
    return this.prisma.sale.create({
      data: {
        productName: product.name,
        sku: product.sku,
        quantity: quantityToSell,
        total: product.price * quantityToSell,
        storeId: product.storeId,
      },
    });
  }

    /**
   * 5. RÉCUPÉRER TOUS LES PRODUITS DE TOUS LES MAGASINS D'UN UTILISATEUR
   */
  async findAllByUserId(userId: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const products = await this.prisma.product.findMany({
      where: { store: { userId } },
      include: {
        store: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      products.map(async (product) => {
        const sales = await this.prisma.sale.findMany({
          where: { 
            storeId: product.storeId,
            productName: product.name,
          },
        });

        const totalSold = sales.reduce((acc, sale) => acc + sale.quantity, 0);

        return {
          ...product,
          initialStock: product.quantity + totalSold, // FORMULE : Quantité actuelle + Quantités vendues
        };
      })
    );
  }

    /**
   * RECHARGER LE STOCK (RÉAPPROVISIONNEMENT)
   */
  async rechargeProduct(id: number, quantityToAdd: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');

    // Règle logistique : Le nouveau stock de départ devient la quantité actuelle + l'apport de la recharge
    const newInitialStock = product.quantity + quantityToAdd;

    return this.prisma.product.update({
      where: { id },
      data: {
        quantity: product.quantity + quantityToAdd, // Ajout au stock réel
        initialStock: newInitialStock,             // Le stock de départ devient la nouvelle référence
      },
    });
  }

  /**
   * RÉCUPÉRER L'HISTORIQUE DES VENTES D'UN MAGASIN
   */
  async findSalesByStore(storeId: number) {
    return this.prisma.sale.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' }, // Les plus récentes en premier
    });
  }
}
