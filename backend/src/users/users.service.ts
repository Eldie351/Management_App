import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
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
   * Créer un membre du personnel (Manager ou Caissier) rattaché à son créateur et à son magasin.
   */
  async createStaffUser(
    data: {
      email: string;
      name: string;
      password: string;
      role: UserRole;
      storeId?: number;
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

    if (data.storeId) {
      const storeExists = await this.prisma.store.findUnique({
        where: { id: data.storeId },
      });
      if (!storeExists) {
        throw new NotFoundException('Le magasin spécifié est introuvable.');
      }
    }

    const hashed = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashed,
        role: data.role,
        assignedStoreId: data.storeId ?? null,
        createdById: creatorId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        assignedStoreId: true,
        createdById: true,
        createdAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
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
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Trouve tous les utilisateurs rattachés à un magasin (propriétaires et employés assignés).
   */
  async findByStore(storeId: number) {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { ownedStores: { some: { id: storeId } } },
          { assignedStoreId: storeId },
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
   * Récupère le profil avec ses magasins possédés (ownedStores) et son magasin assigné (assignedStore).
   */
  async findProfileWithStores(id: number) {
    return this.prisma.user.findUnique({
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
      },
    });
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async setResetToken(id: number, token: string, expiresAt: Date) {
    return this.prisma.user.update({
      where: { id },
      data: {
        resetTokenExp: expiresAt,
        resetToken: {
          upsert: {
            update: { token, expiresAt },
            create: { token, expiresAt },
          },
        },
      },
    });
  }

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

  async updatePassword(id: number, hashedPassword: string) {
    return this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  async clearResetToken(id: number) {
    return this.prisma.user.update({
      where: { id },
      data: {
        resetTokenExp: null,
        resetToken: {
          delete: true,
        },
      },
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        assignedStoreId: true,
        createdById: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRole(id: number, role: UserRole) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });
  }
}