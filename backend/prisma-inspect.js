const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  console.log('user prop exists:', 'user' in prisma);
  console.log('user type:', typeof prisma.user);
  console.log('has findUnique:', prisma.user && typeof prisma.user.findUnique === 'function');
  await prisma.$disconnect();
})();
