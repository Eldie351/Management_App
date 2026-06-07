const {PrismaClient} = require('@prisma/client');
(async ()=>{
  const prisma = new PrismaClient({adapter:{provider:'postgresql'}});
  console.log('ok', 'user' in prisma, typeof prisma.user);
  await prisma.$disconnect();
})().catch(e=>{console.error('err', e.message); process.exit(1);});
