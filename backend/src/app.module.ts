import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { ProductsModule } from './users/stores/products/products.module';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { StoresModule } from './users/stores/stores.module';
import { UsersModule } from './users/users.module';
import { SalesModule } from './sales/sales.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';
import { CategoriesModule } from './users/stores/categories/categories.module';
import { SuppliersModule } from './users/stores/suppliers/suppliers.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule, 
    UsersModule, 
    AuthModule, 
    StoresModule,
    ProductsModule,
    SalesModule,
    ExchangeRateModule,
    CategoriesModule,
    SuppliersModule,
    NotificationsModule,
    AuditLogModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
