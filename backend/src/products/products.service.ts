import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(dto: CreateProductDto) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    const storeExists = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!storeExists) throw new NotFoundException('Magasin introuvable.');

    return this.prisma.product.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        quantity: dto.quantity,
        price: dto.price,
        description: dto.description,
        storeId: dto.storeId,
      },
    });
  }

  async findAllByStore(storeId: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    const products = await this.prisma.product.findMany({
      where: { storeId },
      include: { store: { select: { currency: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      products.map(async (product) => {
        const sales = await this.prisma.sale.findMany({
          where: { 
            storeId: product.storeId,
            productName: product.name,
            createdAt: { gte: product.createdAt },
          },
        });
        const salesCountSinceRecharge = sales.reduce((acc, sale) => acc + sale.quantity, 0);

        return {
          ...product,
          currency: product.store?.currency || 'XOF',
          initialStock: product.quantity + salesCountSinceRecharge,
        };
      })
    );
  }

  async deleteProduct(id: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');

    await this.prisma.product.delete({ where: { id } });
    return { message: 'Produit supprime avec succes.' };
  }

  async sellProduct(id: number, quantityToSell: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');
    if (product.quantity < quantityToSell) throw new BadRequestException(`Stock insuffisant. Unites : ${product.quantity}`);

    await this.prisma.product.update({
      where: { id },
      data: { quantity: product.quantity - quantityToSell },
    });

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

  async rechargeProduct(id: number, quantityToAdd: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');

    return this.prisma.product.update({
      where: { id },
      data: {
        quantity: product.quantity + quantityToAdd,
        createdAt: new Date(),
      },
    });
  }

    /**
   * 6. RÉCUPÉRER L'HISTORIQUE DES VENTES D'UN MAGASIN DEPUIS POSTGRESQL
   */
  async findSalesByStore(storeId: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    return this.prisma.sale.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' }, // Affiche les ventes les plus récentes en premier
    });
  }

  async findAllByUserId(userId: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    const products = await this.prisma.product.findMany({
      where: { store: { userId } },
      include: { store: { select: { name: true, currency: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      products.map(async (product) => {
        const sales = await this.prisma.sale.findMany({
          where: { 
            storeId: product.storeId,
            productName: product.name,
            createdAt: { gte: product.createdAt },
          },
        });
        const salesCountSinceRecharge = sales.reduce((acc, sale) => acc + sale.quantity, 0);

        return {
          ...product,
          currency: product.store?.currency || 'XOF',
          initialStock: product.quantity + salesCountSinceRecharge,
        };
      })
    );
  }
}
