import { Injectable, OnModuleInit } from '@nestjs/common';

let PrismaClientPkg: any;
try {
  PrismaClientPkg = require('@prisma/client');
} catch (e) {
  PrismaClientPkg = null;
}

const PrismaClient = PrismaClientPkg
  ? PrismaClientPkg.PrismaClient
  : class {
      async $connect() {}
      async $disconnect() {}
    };

@Injectable()
export class PrismaService extends (PrismaClient as any) implements OnModuleInit {
  async onModuleInit() {
    if (typeof this.$connect === 'function') {
      await this.$connect();
    }
  }
}