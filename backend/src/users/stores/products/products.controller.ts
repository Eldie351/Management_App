import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsExportService } from './export/products-export.service';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsExportService: ProductsExportService,
  ) {}

  /**
   * Helper privé pour vérifier l'accès d'un utilisateur à un magasin
   */
  private checkStoreAccess(user: any, storeId: number) {
    if (user?.role === UserRole.ADMIN) return;

    const allowedStoreIds = [
      user?.assignedStoreId,
      ...(user?.ownedStores?.map((s: any) => s.id ?? s) ?? []),
      ...(user?.storeAssignments?.map((a: any) => a.storeId ?? a.store?.id ?? a) ?? []),
    ].filter((id): id is number => Boolean(id));

    if (!allowedStoreIds.includes(storeId)) {
      throw new ForbiddenException(
        "Vous n'avez pas accès aux données de ce magasin.",
      );
    }
  }

  // --- Créer / modifier / supprimer -----------------------------------

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: any,
  ) {
    this.checkStoreAccess(user, createProductDto.storeId);
    return this.productsService.createProduct(createProductDto, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    if (updateProductDto.storeId) {
      this.checkStoreAccess(user, updateProductDto.storeId);
    }
    return this.productsService.updateProduct(id, updateProductDto, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.productsService.deleteProduct(id, userId);
  }

  // --- Consultation (ouverte aux 3 rôles pour encaisser) --------------

  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async getLowStock(
    @CurrentUser() user: any,
    @Query('storeId') storeId?: string,
  ) {
    const targetStoreId = storeId ? parseInt(storeId, 10) : undefined;
    if (targetStoreId) {
      this.checkStoreAccess(user, targetStoreId);
    }

    return this.productsService.findLowStock(user, targetStoreId);
  }

  @Get('out-of-stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async getOutOfStock(
    @CurrentUser() user: any,
    @Query('storeId') storeId?: string,
  ) {
    const targetStoreId = storeId ? parseInt(storeId, 10) : undefined;
    if (targetStoreId) {
      this.checkStoreAccess(user, targetStoreId);
    }

    return this.productsService.findOutOfStock(user, targetStoreId);
  }

  @Get('store/:storeId/restock-suggestions')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getRestockSuggestions(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: any,
  ) {
    this.checkStoreAccess(user, storeId);
    return this.productsService.findLowStockProductsByStore(storeId);
  }

  @Get(':id/details')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getDetails(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getProductDetails(id);
  }

  @Get('store/:storeId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findByStore(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: any,
  ) {
    this.checkStoreAccess(user, storeId);
    return this.productsService.findAllByStore(storeId);
  }

  @Get('store/:storeId/sales')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findSalesByStore(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: any,
  ) {
    this.checkStoreAccess(user, storeId);
    return this.productsService.findSalesByStore(storeId, user.id, user.role);
  }

  @Patch(':id/stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async sellProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantity', ParseIntPipe) quantity: number,
    @CurrentUser() user: any,
  ) {
    return this.productsService.sellProduct(id, quantity, user);
  }

  @Get('user/all')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findAllByUser(
    @CurrentUser() user: any,
    @Query('storeId') storeId?: string,
  ) {
    const targetStoreId = storeId ? parseInt(storeId, 10) : undefined;
    if (targetStoreId) {
      this.checkStoreAccess(user, targetStoreId);
    }

    return this.productsService.findAllByUser(user, targetStoreId);
  }

  // --- Mouvements de stock ----------------------------------------------

  @Get('store/:storeId/movements')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getMovements(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: any,
  ) {
    this.checkStoreAccess(user, storeId);
    return this.productsService.getStockMovements(storeId);
  }

  @Patch(':id/recharge')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async rechargeStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantity', ParseIntPipe) quantity: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.productsService.rechargeProduct(id, quantity, userId);
  }

  @Patch(':id/adjust')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async adjustStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('delta', ParseIntPipe) delta: number,
    @Body('note') note: string,
    @CurrentUser('id') userId: number,
  ) {
    return this.productsService.adjustProduct(id, delta, userId, note);
  }

  // --- Export PDF / Excel --------------------------------------------------

  @Get('store/:storeId/export/excel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async exportExcel(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    this.checkStoreAccess(user, storeId);

    const products = await this.productsService.findAllByStore(storeId);
    const buffer = await this.productsExportService.generateProductsExcel(products);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="produits-magasin-${storeId}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('store/:storeId/export/pdf')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async exportPdf(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    this.checkStoreAccess(user, storeId);

    const products = await this.productsService.findAllByStore(storeId);
    const buffer = await this.productsExportService.generateProductsPdf(products);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="produits-magasin-${storeId}.pdf"`,
    });
    res.send(buffer);
  }
}