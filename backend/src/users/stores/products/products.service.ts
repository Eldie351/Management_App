import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MovementType, PaymentMethod, Prisma, UserRole } from '@prisma/client';
import { NotificationsService } from '../../../notifications/notifications.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';
import { assertStoreAccess, buildStoreWhere } from '../../../common/utils/store-access.util';

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  CREATION: 'Création',
  SALE: 'Vente',
  RECHARGE: 'Réapprovisionnement',
  ADJUSTMENT: 'Ajustement',
};

export enum StockAlertLevel {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',         // <= minimumStock (Recommandation de commande)
  CRITICAL = 'CRITICAL',       // <= safetyStock (Urgence absolue)
  OUT_OF_STOCK = 'OUT_OF_STOCK', // Stock épuisé (0)
}

export interface RestockSuggestion {
  id: number;
  name: string;
  sku: string | null;
  unitPrice: number;
  currentStock: number;
  minimumStock: number;
  safetyStock: number;
  optimalStock: number;
  status: StockAlertLevel;
  suggestedQuantityToOrder: number;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * BUGFIX : cette méthode retournait `{}` (= AUCUN filtre = tous les
   * magasins de tous les commerces) pour un ADMIN sans storeId précisé, et
   * ne vérifiait même pas que le storeId demandé lui appartenait. Elle
   * délègue maintenant à `buildStoreWhere`, qui applique la même règle à
   * tous les rôles : accès uniquement aux magasins possédés/assignés.
   */
  private getStoreFilterForUser(user: any, requestedStoreId?: number): any {
    return buildStoreWhere(user, requestedStoreId);
  }

  /**
   * Évalue le niveau d'alerte statut d'un produit selon ses seuils
   */
  checkStockStatus(product: {
    quantity: number;
    minimumStock: number;
    safetyStock: number;
  }): StockAlertLevel {
    if (product.quantity <= 0) {
      return StockAlertLevel.OUT_OF_STOCK;
    }
    if (product.quantity <= product.safetyStock) {
      return StockAlertLevel.CRITICAL;
    }
    if (product.quantity <= product.minimumStock) {
      return StockAlertLevel.WARNING;
    }
    return StockAlertLevel.NORMAL;
  }

  /**
   * Calcule la quantité idéale à commander (optimalStock - currentStock)
   */
  calculateRestockQuantity(product: {
    quantity: number;
    minimumStock: number;
    optimalStock?: number | null;
  }): number {
    const target = product.optimalStock ?? product.minimumStock * 3;
    const qtyToOrder = target - product.quantity;
    return Math.max(0, qtyToOrder);
  }

  /**
   * Récupère la liste structurée des produits nécessitant un réapprovisionnement pour un magasin donné
   */
  async findLowStockProductsByStore(storeId: number): Promise<RestockSuggestion[]> {
    const storeExists = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!storeExists) {
      throw new NotFoundException(`Le magasin avec l'ID ${storeId} n'existe pas.`);
    }

    const products = await this.prisma.product.findMany({
      where: {
        storeId,
        deletedAt: null,
      },
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true, phone: true, email: true } },
      },
      orderBy: { quantity: 'asc' },
    });

    const lowStockItems: RestockSuggestion[] = [];

    for (const product of products) {
      const status = this.checkStockStatus(product);

      if (status !== StockAlertLevel.NORMAL) {
        const optimalStock = product.optimalStock ?? product.minimumStock * 3;
        const suggestedQuantityToOrder = this.calculateRestockQuantity(product);

        lowStockItems.push({
          id: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: Number(product.sellingPrice),
          currentStock: product.quantity,
          minimumStock: product.minimumStock,
          safetyStock: product.safetyStock,
          optimalStock,
          status,
          suggestedQuantityToOrder,
        });
      }
    }

    const priorityOrder = {
      [StockAlertLevel.OUT_OF_STOCK]: 1,
      [StockAlertLevel.CRITICAL]: 2,
      [StockAlertLevel.WARNING]: 3,
      [StockAlertLevel.NORMAL]: 4,
    };

    return lowStockItems.sort(
      (a, b) => priorityOrder[a.status] - priorityOrder[b.status],
    );
  }

  /**
   * Un même magasin ne peut pas avoir deux produits (non archivés) portant
   * le même nom (comparaison insensible à la casse/aux espaces superflus).
   */
  private async assertNoDuplicateName(storeId: number, name: string, excludeProductId?: number) {
    const existing = await this.prisma.product.findFirst({
      where: {
        storeId,
        deletedAt: null,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(
        `Un produit nommé "${existing.name}" existe déjà dans ce magasin.`,
      );
    }
  }

  /**
   * Signature d'un nom de produit indépendante de l'ordre des mots :
   * "Portable 1" et "1 Portable" doivent produire la même signature, pour
   * détecter les noms probablement redondants qui échappent à la
   * comparaison exacte de `assertNoDuplicateName`.
   */
  private wordOrderSignature(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ');
  }

  /**
   * Retourne les produits (non archivés) du magasin dont le nom contient
   * exactement les mêmes mots que `name`, dans un ordre différent (les
   * doublons exacts, déjà bloqués par `assertNoDuplicateName`, sont exclus
   * ici pour ne pas doubler l'avertissement).
   */
  async findSimilarByWordOrder(storeId: number, name: string, excludeProductId?: number) {
    const signature = this.wordOrderSignature(name);
    if (!signature || !signature.includes(' ')) {
      // Un nom d'un seul mot ne peut pas être "réordonné".
      return [];
    }

    const trimmedInput = name.trim().toLowerCase();

    const candidates = await this.prisma.product.findMany({
      where: {
        storeId,
        deletedAt: null,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      },
      select: { id: true, name: true, sku: true, quantity: true },
    });

    return candidates.filter(
      (p) =>
        p.name.trim().toLowerCase() !== trimmedInput &&
        this.wordOrderSignature(p.name) === signature,
    );
  }

  /**
   * Réserve la prochaine référence OCTO-a-N du magasin (a : rang du magasin
   * chez son propriétaire sur 2 chiffres, N : rang de création du produit).
   * L'incrément atomique de Store.productSeq verrouille la ligne du magasin
   * jusqu'à la fin de la transaction : deux créations simultanées ne peuvent
   * pas obtenir le même N.
   */
  private async nextProductReference(tx: Prisma.TransactionClient, storeId: number) {
    const { storeNumber, productSeq } = await tx.store.update({
      where: { id: storeId },
      data: { productSeq: { increment: 1 } },
      select: { storeNumber: true, productSeq: true },
    });
    return `OCTO-${String(storeNumber).padStart(2, '0')}-${productSeq}`;
  }

  async createProduct(dto: CreateProductDto & { safetyStock?: number; optimalStock?: number }, userId: number) {
    const storeExists = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
    });
    if (!storeExists) throw new NotFoundException('Magasin introuvable.');

    await this.assertNoDuplicateName(dto.storeId, dto.name);

    // BUGFIX : on vérifiait seulement que la catégorie/le fournisseur
    // existait quelque part en base, sans vérifier qu'il appartenait au
    // même magasin que le produit. N'importe quel ADMIN pouvait ainsi lier
    // son produit à un fournisseur/une catégorie d'un AUTRE commerce et en
    // exposer les données (ex. coordonnées du fournisseur) via les
    // suggestions de réapprovisionnement.
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Catégorie introuvable.');
      if (category.storeId !== dto.storeId) {
        throw new NotFoundException('Catégorie introuvable.');
      }
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier) throw new NotFoundException('Fournisseur introuvable.');
      if (supplier.storeId !== dto.storeId) {
        throw new NotFoundException('Fournisseur introuvable.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          sku: await this.nextProductReference(tx, dto.storeId),
          quantity: dto.quantity,
          initialStock: dto.quantity,
          purchasePrice: dto.price,
          sellingPrice: dto.price,
          description: dto.description,
          storeId: dto.storeId,
          minimumStock: dto.minimumStock ?? 5,
          safetyStock: dto.safetyStock ?? 2,
          optimalStock: dto.optimalStock ?? null,
          categoryId: dto.categoryId,
          supplierId: dto.supplierId,
        },
      });

      if (dto.quantity > 0) {
        await tx.stockMovement.create({
          data: {
            quantity: dto.quantity,
            type: MovementType.CREATION,
            productId: product.id,
            storeId: product.storeId,
            userId,
            note: 'Stock initial à la création du produit',
          },
        });
      }

      await this.auditLogService.log(
        userId,
        `a créé le produit "${product.name}"`,
        'Product',
        product.id,
        tx,
      );

      return product;
    });
  }

  async updateProduct(id: number, dto: UpdateProductDto & { safetyStock?: number; optimalStock?: number; quantity?: number }, user: any) {
    const userId = user?.id ?? user;
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

    // BUGFIX : rien ne vérifiait que le produit modifié appartenait à un
    // magasin de l'utilisateur (le contrôle n'existait que si `storeId`
    // était explicitement fourni dans le body, ce qui n'est pas le cas pour
    // une simple modification de prix/nom/stock). N'importe quel ADMIN
    // pouvait donc modifier un produit d'un autre commerce.
    assertStoreAccess(user, product.storeId, "Vous n'avez pas accès à ce produit.");

    if (dto.storeId && dto.storeId !== product.storeId) {
      const storeExists = await this.prisma.store.findUnique({
        where: { id: dto.storeId },
      });
      if (!storeExists) throw new NotFoundException('Le nouveau magasin spécifié est introuvable.');
      // BUGFIX : vérifie aussi que le magasin DE DESTINATION appartient à
      // l'utilisateur (sinon on pourrait "déplacer" un produit vers le
      // magasin d'un autre commerce).
      assertStoreAccess(user, dto.storeId, "Vous n'avez pas accès au magasin de destination.");
    }

    // BUGFIX : mêmes vérifications d'appartenance au magasin que dans
    // createProduct (cf. commentaire ci-dessus) — on utilise le magasin de
    // destination effectif (dto.storeId si fourni, sinon le magasin actuel
    // du produit).
    const effectiveStoreId = dto.storeId ?? product.storeId;

    const effectiveName = dto.name ?? product.name;
    if (dto.name !== undefined || dto.storeId !== undefined) {
      await this.assertNoDuplicateName(effectiveStoreId, effectiveName, product.id);
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Catégorie introuvable.');
      if (category.storeId !== effectiveStoreId) {
        throw new NotFoundException('Catégorie introuvable.');
      }
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier) throw new NotFoundException('Fournisseur introuvable.');
      if (supplier.storeId !== effectiveStoreId) {
        throw new NotFoundException('Fournisseur introuvable.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const newQuantity = dto.quantity !== undefined ? Number(dto.quantity) : product.quantity;
      const delta = newQuantity - product.quantity;

      // Un produit déplacé prend la référence suivante de son nouveau
      // magasin (la numérotation OCTO-a-N est propre à chaque magasin).
      const movesStore = dto.storeId !== undefined && dto.storeId !== product.storeId;

      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          sku: movesStore ? await this.nextProductReference(tx, dto.storeId!) : undefined,
          quantity: dto.quantity !== undefined ? Number(dto.quantity) : undefined,
          purchasePrice: dto.price !== undefined ? dto.price : undefined,
          sellingPrice: dto.price !== undefined ? dto.price : undefined,
          description: dto.description,
          storeId: dto.storeId !== undefined ? dto.storeId : undefined,
          minimumStock: dto.minimumStock !== undefined ? dto.minimumStock : undefined,
          safetyStock: dto.safetyStock !== undefined ? dto.safetyStock : undefined,
          optimalStock: dto.optimalStock !== undefined ? dto.optimalStock : undefined,
          categoryId: dto.categoryId !== undefined ? dto.categoryId : undefined,
          supplierId: dto.supplierId !== undefined ? dto.supplierId : undefined,
        },
      });

      if (delta !== 0) {
        await tx.stockMovement.create({
          data: {
            quantity: delta,
            type: MovementType.ADJUSTMENT,
            productId: product.id,
            storeId: updatedProduct.storeId,
            userId,
            note: 'Ajustement manuel via modification de la fiche produit',
          },
        });
      }

      await this.auditLogService.log(
        userId,
        `a modifié le produit "${updatedProduct.name}"`,
        'Product',
        id,
        tx,
      );

      return updatedProduct;
    });
  }

  async findLowStock(user: any, storeId?: number) {
    const storeFilter = this.getStoreFilterForUser(user, storeId);

    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        store: storeFilter,
      },
      include: {
        store: { select: { name: true, currency: true } },
      },
      orderBy: { quantity: 'asc' },
    });

    return products.filter((p) => p.quantity > 0 && p.quantity <= p.minimumStock);
  }

  async findOutOfStock(user: any, storeId?: number) {
    const storeFilter = this.getStoreFilterForUser(user, storeId);

    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        quantity: { lte: 0 },
        store: storeFilter,
      },
      include: {
        store: { select: { name: true, currency: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findAllByStore(storeId: number) {
    return this.prisma.product.findMany({
      where: {
        storeId,
        deletedAt: null,
      },
      include: {
        store: {
          select: {
            currency: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Nom (et devise) du magasin, pour l'en-tête et le nom de fichier des
   * exports PDF/Excel — on ne veut jamais afficher l'ID numérique du
   * magasin à l'utilisateur, seulement son nom.
   */
  async getStoreForExport(storeId: number): Promise<{ name: string; currency: string }> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true, currency: true },
    });
    return store ?? { name: `Magasin ${storeId}`, currency: 'XOF' };
  }

  async deleteProduct(id: number, user: any) {
    const userId = user?.id ?? user;
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');

    // BUGFIX : aucune vérification n'existait ici — n'importe quel ADMIN
    // pouvait supprimer (archiver) le produit de n'importe quel commerce.
    assertStoreAccess(user, product.storeId, "Vous n'avez pas accès à ce produit.");

    await this.prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.auditLogService.log(
      userId,
      `a supprimé le produit "${product.name}"`,
      'Product',
      id,
    );

    return { message: 'Produit archivé avec succès.' };
  }

  async sellProduct(id: number, quantityToSell: number, user: any) {
    if (quantityToSell <= 0) {
      throw new BadRequestException('La quantité vendue doit être supérieure à 0.');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

      // BUGFIX : le contrôle d'accès s'appliquait uniquement aux non-ADMIN,
      // permettant à n'importe quel ADMIN de vendre des produits appartenant
      // à un magasin d'un AUTRE commerce. Il s'applique maintenant à tous,
      // ADMIN inclus (ADMIN n'a accès qu'à SES propres magasins).
      assertStoreAccess(
        user,
        product.storeId,
        "Vous ne pouvez effectuer de vente que dans l'un de vos magasins autorisés.",
      );

      if (product.quantity < quantityToSell) {
        throw new BadRequestException(
          `Stock insuffisant. Unités disponibles : ${product.quantity}`,
        );
      }

      // BUGFIX : `product.sellingPrice` est un Decimal Prisma ; le multiplier
      // directement par un number peut produire NaN/une chaîne concaténée
      // selon le runtime. On le convertit explicitement, comme fait ailleurs
      // dans le code (stores.service, sales.service, reports.service).
      const totalAmount = Number(product.sellingPrice) * quantityToSell;

      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          quantity: product.quantity - quantityToSell,
        },
      });

      await tx.stockMovement.create({
        data: {
          quantity: -quantityToSell,
          type: MovementType.SALE,
          productId: product.id,
          storeId: product.storeId,
          userId: user.id,
          note: 'Vente produit',
        },
      });

      const invoiceNumber = `FAC-${Date.now()}`;

      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          totalAmount,
          paymentMethod: PaymentMethod.CASH,
          storeId: product.storeId,
          userId: user.id,
          items: {
            create: [
              {
                productId: product.id,
                quantity: quantityToSell,
                unitPrice: product.sellingPrice,
                total: totalAmount,
              },
            ],
          },
        },
        include: {
          items: { include: { product: true } },
        },
      });

      await this.notificationsService.checkStockThreshold(tx, {
        storeId: product.storeId,
        productId: product.id,
        productName: product.name,
        minimumStock: product.minimumStock,
        previousQuantity: product.quantity,
        newQuantity: updatedProduct.quantity,
      });

      await this.auditLogService.log(
        user.id,
        `a vendu ${quantityToSell} unité(s) de "${product.name}"`,
        'Product',
        product.id,
        tx,
      );

      return {
        product: updatedProduct,
        sale,
      };
    });
  }

  async rechargeProduct(id: number, quantityToAdd: number, user: any) {
    const userId = user?.id ?? user;
    if (quantityToAdd <= 0) {
      throw new BadRequestException('La quantité rechargée doit être supérieure à 0.');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

      // BUGFIX CRITIQUE : cette méthode ne faisait AUCUNE vérification
      // d'accès, y compris pour les non-ADMIN. N'importe quel MANAGER (ou
      // ADMIN) authentifié pouvait réapprovisionner le stock d'un produit
      // appartenant à un magasin d'un AUTRE commerce, juste en connaissant
      // l'ID du produit.
      assertStoreAccess(user, product.storeId, "Vous n'avez pas accès à ce produit.");

      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          quantity: product.quantity + quantityToAdd,
        },
      });

      await tx.stockMovement.create({
        data: {
          quantity: quantityToAdd,
          type: MovementType.RECHARGE,
          productId: product.id,
          storeId: product.storeId,
          userId,
          note: 'Réapprovisionnement',
        },
      });

      await this.auditLogService.log(
        userId,
        `a réapprovisionné "${product.name}" de ${quantityToAdd} unité(s)`,
        'Product',
        product.id,
        tx,
      );

      return updatedProduct;
    });
  }

  async adjustProduct(id: number, delta: number, user: any, note?: string) {
    const userId = user?.id ?? user;
    if (delta === 0) {
      throw new BadRequestException('La correction ne peut pas être nulle.');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

      // BUGFIX CRITIQUE : même faille que rechargeProduct — aucun contrôle
      // d'accès n'existait, permettant à n'importe quel utilisateur
      // authentifié d'ajuster le stock d'un produit d'un autre commerce.
      assertStoreAccess(user, product.storeId, "Vous n'avez pas accès à ce produit.");

      const newQuantity = product.quantity + delta;
      if (newQuantity < 0) {
        throw new BadRequestException(
          `Cette correction ferait passer le stock en négatif (actuel : ${product.quantity}).`,
        );
      }

      const updatedProduct = await tx.product.update({
        where: { id },
        data: { quantity: newQuantity },
      });

      await tx.stockMovement.create({
        data: {
          quantity: delta,
          type: MovementType.ADJUSTMENT,
          productId: product.id,
          storeId: product.storeId,
          userId,
          note: note ?? 'Correction manuelle de stock',
        },
      });

      if (delta < 0) {
        await this.notificationsService.checkStockThreshold(tx, {
          storeId: product.storeId,
          productId: product.id,
          productName: product.name,
          minimumStock: product.minimumStock,
          previousQuantity: product.quantity,
          newQuantity: updatedProduct.quantity,
        });
      }

      await this.auditLogService.log(
        userId,
        `a ajusté le stock de "${product.name}" de ${delta > 0 ? '+' : ''}${delta}`,
        'Product',
        product.id,
        tx,
      );

      return updatedProduct;
    });
  }

  async findSalesByStore(storeId: number, userId: number, role: UserRole) {
    const where = role === UserRole.CASHIER ? { storeId, userId } : { storeId };

    return this.prisma.sale.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                sellingPrice: true,
                purchasePrice: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getStockMovements(storeId: number) {
    return this.prisma.stockMovement.findMany({
      where: { storeId },
      include: { product: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProductDetails(id: number, user: any) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        store: {
          select: { name: true, currency: true },
        },
      },
    });
    if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

    // BUGFIX : cet endpoint n'avait AUCUNE vérification d'accès — n'importe
    // quel utilisateur authentifié pouvait consulter le détail d'un produit
    // de n'importe quel commerce en devinant son ID.
    assertStoreAccess(user, product.storeId, "Vous n'avez pas accès à ce produit.");

    const salesItemAgg = await this.prisma.saleItem.aggregate({
      where: { productId: id },
      _sum: { quantity: true },
    });

    const salesCount = await this.prisma.saleItem.count({
      where: { productId: id },
    });

    const rechargesAgg = await this.prisma.stockMovement.aggregate({
      where: { productId: id, type: MovementType.RECHARGE },
      _sum: { quantity: true },
      _count: true,
      _max: { createdAt: true },
    });

    const movements = await this.prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      select: { type: true, quantity: true, createdAt: true, note: true },
    });

    const lastSaleItem = await this.prisma.saleItem.findFirst({
      where: { productId: id },
      orderBy: { sale: { createdAt: 'desc' } },
      select: { sale: { select: { createdAt: true } } },
    });

    return {
      general: {
        name: product.name,
        sku: product.sku,
        description: product.description,
        price: product.sellingPrice,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },

      stock: {
        currentStock: product.quantity,
        initialStock: product.initialStock,
        minimumStock: product.minimumStock,
        safetyStock: product.safetyStock,
        optimalStock: product.optimalStock ?? product.minimumStock * 3,
        stockValue: product.quantity * Number(product.sellingPrice),
        status: this.checkStockStatus(product),
      },

      stats: {
        totalSold: salesItemAgg._sum.quantity ?? 0,
        salesCount: salesCount,
        totalRecharged: rechargesAgg._sum.quantity ?? 0,
        rechargesCount: rechargesAgg._count,
        lastSaleDate: lastSaleItem?.sale?.createdAt ?? null,
        lastRechargeDate: rechargesAgg._max.createdAt,
      },

      history: movements.map((m) => ({
        type: m.type,
        typeLabel: MOVEMENT_TYPE_LABELS[m.type],
        quantity: m.quantity,
        date: m.createdAt,
        note: m.note,
      })),

      store: {
        name: product.store.name,
        currency: product.store.currency,
      },
    };
  }

  async findAllByUser(user: any, storeId?: number) {
    const storeFilter = this.getStoreFilterForUser(user, storeId);

    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        store: storeFilter,
      },
      include: {
        store: {
          select: {
            name: true,
            currency: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}