const {PrismaClient} = require('@prisma/client');
(async ()=>{
  const prisma = new PrismaClient({});
  console.log('created prisma', prisma && typeof prisma.user);
  console.log('user in prisma', 'user' in prisma);
  await prisma.$disconnect();
})().catch(err=>{console.error(err); process.exit(1);});
