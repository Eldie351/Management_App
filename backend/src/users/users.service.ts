import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
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
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: email },
    });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashed = await bcrypt.hash(passwordPlain, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        password: hashed,
      },
    });

    return user;
  }

  async createStaffUser(data: {
    email: string;
    name: string;
    password: string;
    role: UserRole;
  }) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    if (data.role !== UserRole.MANAGER && data.role !== UserRole.CASHIER) {
      throw new BadRequestException(
        'Seuls les rôles MANAGER et CASHIER peuvent être créés via cette action.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashed = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashed,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByStore(storeId: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    return this.prisma.user.findMany({
      where: { stores: { some: { id: storeId } } },
    });
  }

  async findProfileWithStores(id: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        stores: {
          select: {
            id: true,
            name: true,
            location: true,
            currency: true,
            _count: {
              select: { products: true },
            },
          },
        },
      },
    });
  }

  async findById(id: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }
    return this.prisma.user.findUnique({ where: { id } });
  }

  async setResetToken(id: number, token: string, expiresAt: Date) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    // AJUSTEMENT : On met à jour `resetTokenExp` sur User et on gère la table ResetToken en relation
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
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    // AJUSTEMENT : Recherche par la clé unique `token` de la table ResetToken
    const tokenRecord = await this.prisma.resetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!tokenRecord) {
      return null;
    }

    // Renvoie l'utilisateur lié avec la propriété de temps pour ton AuthService
    return {
      ...tokenRecord.user,
      resetTokenExp: tokenRecord.expiresAt,
    };
  }

  async updatePassword(id: number, hashedPassword: string) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    return this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  async clearResetToken(id: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    // AJUSTEMENT : On nettoie `resetTokenExp` de User et on supprime la relation ResetToken en cascade
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
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    await this.prisma.user.delete({ where: { id } });
  }

  /**
   * ⚠️ Liste TOUS les utilisateurs du système (pas de notion de "staff d'un
   * magasin" dans le schéma actuel — voir note dans users.controller.ts).
   */
  async findAll() {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRole(id: number, role: UserRole) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });
  }
}
