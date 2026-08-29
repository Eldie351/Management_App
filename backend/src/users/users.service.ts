import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(email: string, name: string, passwordPlain: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email déjà utilisé.');
    }

    const hashed = await bcrypt.hash(passwordPlain, 10);

    return this.prisma.user.create({
      data: {
        email,
        name,
        password: hashed,
      },
    });
  }

  /**
   * Créer un membre du personnel (Manager ou Caissier) rattaché à son créateur et à ses magasins.
   */
  async createStaffUser(
    data: {
      email: string;
      name: string;
      password: string;
      role: UserRole;
      storeIds?: number[];
    },
    creatorId: number,
  ) {
    if (data.role !== UserRole.MANAGER && data.role !== UserRole.CASHIER) {
      throw new BadRequestException(
        'Seuls les rôles MANAGER et CASHIER peuvent être créés via cette action.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new ConflictException('Email déjà utilisé.');
    }

    const uniqueStoreIds = Array.from(new Set(data.storeIds || []));
    if (uniqueStoreIds.length > 0) {
      // BUGFIX (critique) : la version précédente vérifiait seulement que
      // les magasins EXISTENT quelque part dans la base — pas qu'ils
      // appartiennent à l'admin qui crée le compte. N'importe quel ADMIN
      // pouvait donc assigner un employé aux magasins d'un AUTRE commerce,
      // donnant à cet employé un accès cross-tenant complet.
      const stores = await this.prisma.store.findMany({
        where: { id: { in: uniqueStoreIds } },
      });

      if (stores.length !== uniqueStoreIds.length) {
        throw new NotFoundException('Un ou plusieurs magasins spécifiés sont introuvables.');
      }

      const notOwned = stores.filter((s) => s.userId !== creatorId);
      if (notOwned.length > 0) {
        throw new ForbiddenException(
          "Vous ne pouvez assigner un employé qu'à des magasins que vous possédez.",
        );
      }
    }

    const hashed = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashed,
        role: data.role,
        assignedStoreId: uniqueStoreIds[0] ?? null,
        createdById: creatorId,
        storeAssignments: uniqueStoreIds.length
          ? { create: uniqueStoreIds.map((storeId) => ({ storeId })) }
          : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        assignedStoreId: true,
        createdById: true,
        createdAt: true,
        ownedStores: { select: { id: true, name: true } },
        storeAssignments: {
          select: {
            storeId: true,
            store: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Trouve un utilisateur par son email en incluant ses magasins possédés et assignés.
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        ownedStores: {
          select: {
            id: true,
            name: true,
          },
        },
        storeAssignments: {
          select: {
            storeId: true,
            store: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });
  }

  /**
   * Récupère tous les utilisateurs créés par un administrateur spécifique.
   */
  async findCreatedByAdmin(adminId: number) {
    return this.prisma.user.findMany({
      where: { createdById: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        assignedStore: {
          select: { id: true, name: true, location: true },
        },
        ownedStores: {
          select: { id: true, name: true },
        },
        storeAssignments: {
          select: {
            storeId: true,
            store: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Trouve tous les utilisateurs rattachés à un magasin (propriétaires, magasin principal et secondaire).
   */
  async findByStore(storeId: number) {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { ownedStores: { some: { id: storeId } } },
          { assignedStoreId: storeId },
          { storeAssignments: { some: { storeId } } },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        assignedStoreId: true,
        createdById: true,
      },
    });
  }

  /**
   * Récupère le profil complet avec tous ses magasins (possédés, assignés et secondaires).
   */
  async findProfileWithStores(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdById: true,
        createdAt: true,
        ownedStores: {
          select: {
            id: true,
            name: true,
            location: true,
            currency: true,
            _count: {
              select: { products: true, sales: true },
            },
          },
        },
        assignedStore: {
          select: {
            id: true,
            name: true,
            location: true,
            currency: true,
          },
        },
        storeAssignments: {
          select: {
            storeId: true,
            store: {
              select: {
                id: true,
                name: true,
                location: true,
                currency: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    const assignedStoresList = user.storeAssignments
      ?.map((sa) => sa.store)
      .filter((s) => s !== null) || [];

    return {
      ...user,
      stores: assignedStoresList,
    };
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        ownedStores: {
          select: { id: true, name: true },
        },
        storeAssignments: {
          select: {
            storeId: true,
            store: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  /**
   * Enregistre ou met à jour le token de réinitialisation.
   */
  async setResetToken(id: number, token: string, expiresAt: Date) {
    await this.prisma.user.update({
      where: { id },
      data: { resetTokenExp: expiresAt },
    });

    return this.prisma.resetToken.upsert({
      where: { userId: id },
      update: { token, expiresAt },
      create: { userId: id, token, expiresAt },
    });
  }

  /**
   * Retrouve un utilisateur via le token stocké dans la table ResetToken.
   */
  async findByResetToken(token: string) {
    const tokenRecord = await this.prisma.resetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!tokenRecord) {
      return null;
    }

    return {
      ...tokenRecord.user,
      resetTokenExp: tokenRecord.expiresAt,
    };
  }

  /**
   * Met à jour le mot de passe de l'utilisateur.
   */
  async updatePassword(id: number, hashedPassword: string) {
    return this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  /**
   * Supprime le token de réinitialisation après utilisation.
   */
  async clearResetToken(id: number) {
    await this.prisma.resetToken.deleteMany({
      where: { userId: id },
    });

    return this.prisma.user.update({
      where: { id },
      data: { resetTokenExp: null },
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  /**
   * BUGFIX (critique) : cette méthode faisait un `findMany()` sans AUCUN
   * filtre — elle listait les utilisateurs de TOUS les commerces de
   * l'application. Elle a été retirée ; utiliser `findCreatedByAdmin(adminId)`
   * qui scope correctement la liste à l'équipe de l'admin appelant.
   */

  async updateRole(id: number, role: UserRole, adminId: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    // BUGFIX (critique) : aucune vérification n'existait — n'importe quel
    // ADMIN pouvait changer le rôle de N'IMPORTE QUEL utilisateur du
    // système, y compris l'ADMIN d'un autre commerce (ex: le rétrograder
    // en CASHIER pour prendre le contrôle de son compte).
    if (user.createdById !== adminId) {
      throw new ForbiddenException(
        "Vous ne pouvez modifier que le rôle des membres de votre propre équipe.",
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  /**
   * Supprime un membre du personnel, en vérifiant qu'il a bien été créé par
   * cet administrateur.
   *
   * BUGFIX (critique) : l'ancienne route DELETE /users/:id appelait
   * directement `delete(id)` sans aucune vérification de propriété —
   * n'importe quel ADMIN pouvait supprimer le compte de n'importe quel
   * autre utilisateur du système, y compris un ADMIN d'un autre commerce.
   */
  async deleteStaffMember(id: number, adminId: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    if (user.createdById !== adminId) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que les membres de votre propre équipe.',
      );
    }

    await this.prisma.user.delete({ where: { id } });
  }
}