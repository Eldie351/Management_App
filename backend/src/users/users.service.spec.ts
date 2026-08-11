import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));
import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws if email already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 1, email: 'a@a.com' });
    await expect(service.create('a@a.com', 'A', 'pw')).rejects.toThrow(
      'Email déjà utilisé.',
    );
  });

  it('creates a user with hashed password', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const hashed = 'hashed-password';
    (bcrypt.hash as jest.Mock).mockResolvedValue(hashed);
    const created = { id: 1, email: 'b@b.com', name: 'B', password: hashed };
    prismaMock.user.create.mockResolvedValue(created);

    const result = await service.create('b@b.com', 'B', 'plain');

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: { email: 'b@b.com', name: 'B', password: hashed },
    });
    expect(result).toEqual(created);
  });

  it('delegates findByEmail to prisma', async () => {
    const user = { id: 2, email: 'c@c.com' };
    prismaMock.user.findUnique.mockResolvedValue(user);
    const res = await service.findByEmail('c@c.com');
    expect(res).toEqual(user);
  });

  it('creates a manager or cashier for admin', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const hashed = 'hashed-password';
    (bcrypt.hash as jest.Mock).mockResolvedValue(hashed);
    const created = {
      id: 7,
      email: 'staff@demo.com',
      name: 'Staff',
      password: hashed,
      role: 'CASHIER',
    };
    prismaMock.user.create.mockResolvedValue(created);

    const result = await service.createStaffUser({
      email: 'staff@demo.com',
      name: 'Staff',
      password: 'plain',
      role: 'CASHIER',
    } as any);

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        email: 'staff@demo.com',
        name: 'Staff',
        password: hashed,
        role: 'CASHIER',
        assignedStoreId: null,
        createdById: undefined,
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
    expect(result).toEqual(created);
  });

  it('finds users by store id', async () => {
    const users = [{ id: 5, email: 'd@d.com' }];
    prismaMock.user.findMany.mockResolvedValue(users);
    const res = await service.findByStore(10);
    
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { ownedStores: { some: { id: 10 } } },
          { assignedStoreId: 10 },
        ],
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
    expect(res).toEqual(users);
  });

  it('deletes a user by id', async () => {
    prismaMock.user.delete.mockResolvedValue({});
    await service.delete(3);
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });
});