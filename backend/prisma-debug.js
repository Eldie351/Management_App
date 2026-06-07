const pkg = require('@prisma/client');
console.log('pkg keys', Object.keys(pkg));
console.log('PrismaClient', pkg.PrismaClient ? 'exists' : 'missing');
console.log('typeof PrismaClient', typeof pkg.PrismaClient);
console.log('PrismaClient prototype:', pkg.PrismaClient && Object.getOwnPropertyNames(pkg.PrismaClient.prototype));
console.log('default', pkg.default ? Object.keys(pkg.default) : 'no default');
