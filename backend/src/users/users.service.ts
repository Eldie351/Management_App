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
          _count: {
            select: { products: true } // Compte le nombre de produits par magasin
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

  async delete(id: number): Promise<void> {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    await this.prisma.user.delete({ where: { id } });
  }
}
