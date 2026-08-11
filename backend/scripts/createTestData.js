const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // 1. Upsert admin
  const adminPassword = 'AdminPass123!';
  const hashedAdmin = await bcrypt.hash(adminPassword, 10);
  let admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@test.local',
        name: 'Admin Test',
        password: hashedAdmin,
        role: 'ADMIN',
      },
    });
    console.log('Created admin:', admin.email);
  } else {
    console.log('Admin already exists:', admin.email);
  }

  // 2. Create a store owned by admin
  let store = await prisma.store.findFirst({ where: { userId: admin.id } });
  if (!store) {
    store = await prisma.store.create({
      data: {
        name: 'Test Store',
        location: 'Local dev',
        currency: 'XOF',
        userId: admin.id,
      },
    });
    console.log('Created store:', store.id);
  } else {
    console.log('Store already exists:', store.id);
  }

  // 3. Upsert cashier assigned to that store
  const cashierPassword = 'CashierPass123!';
  const hashedCashier = await bcrypt.hash(cashierPassword, 10);
  let cashier = await prisma.user.findUnique({ where: { email: 'cashier@test.local' } });
  if (!cashier) {
    cashier = await prisma.user.create({
      data: {
        email: 'cashier@test.local',
        name: 'Cashier Test',
        password: hashedCashier,
        role: 'CASHIER',
        assignedStoreId: store.id,
        storeAssignments: {
          create: [{ storeId: store.id }],
        },
        createdById: admin.id,
      },
    });
    console.log('Created cashier:', cashier.email);
  } else {
    console.log('Cashier already exists:', cashier.email);
    // ensure assignment
    await prisma.user.update({ where: { id: cashier.id }, data: { assignedStoreId: store.id } });
    const existing = await prisma.storeAssignment.findFirst({ where: { userId: cashier.id, storeId: store.id } });
    if (!existing) {
      await prisma.storeAssignment.create({ data: { userId: cashier.id, storeId: store.id } });
    }
  }

  console.log('Passwords: admin=', adminPassword, ' cashier=', cashierPassword);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
