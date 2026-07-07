import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

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
              select: { products: true }
            }
          }
        }
      }
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
}