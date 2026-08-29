import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { NotificationsModule } from '../../../notifications/notifications.module';
import { AuditLogModule } from '../../../audit-log/audit-log.module';
import { ProductsExportService } from './export/products-export.service';

@Module({
  imports: [NotificationsModule, AuditLogModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsExportService],
})
export class ProductsModule {}
