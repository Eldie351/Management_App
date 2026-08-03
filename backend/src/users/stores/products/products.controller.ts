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

  // --- Créer / modifier / supprimer -----------------------------------

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: any,
  ) {
    if (
      user.role === UserRole.MANAGER &&
      user.assignedStoreId !== createProductDto.storeId
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez ajouter des produits que dans votre magasin assigné.',
      );
    }
    return this.productsService.createProduct(createProductDto, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
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
    const targetStoreId = storeId ? parseInt(storeId, 10) : user.assignedStoreId;
    
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== targetStoreId) {
      throw new ForbiddenException('Accès refusé aux données de ce magasin.');
    }

    return this.productsService.findLowStock(user.id, targetStoreId);
  }

  @Get('out-of-stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async getOutOfStock(
    @CurrentUser() user: any,
    @Query('storeId') storeId?: string,
  ) {
    const targetStoreId = storeId ? parseInt(storeId, 10) : user.assignedStoreId;

    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== targetStoreId) {
      throw new ForbiddenException('Accès refusé aux données de ce magasin.');
    }

    return this.productsService.findOutOfStock(user.id, targetStoreId);
  }

  @Get(':id/details')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async getDetails(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getProductDetails(id);
  }

  @Get('store/:storeId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findByStore(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: any,
  ) {
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== storeId) {
      throw new ForbiddenException('Accès refusé aux produits de ce magasin.');
    }
    return this.productsService.findAllByStore(storeId);
  }

  @Get('user/all')
  @Roles(UserRole.ADMIN)
  async findAllByUser(@CurrentUser('id') userId: number) {
    return this.productsService.findAllByUserId(userId);
  }

  // --- Mouvements de stock ----------------------------------------------

  @Get('store/:storeId/movements')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getMovements(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: any,
  ) {
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== storeId) {
      throw new ForbiddenException(
        'Accès refusé aux mouvements de stock de ce magasin.',
      );
    }
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
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== storeId) {
      throw new ForbiddenException('Accès refusé.');
    }

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
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== storeId) {
      throw new ForbiddenException('Accès refusé.');
    }

    const products = await this.productsService.findAllByStore(storeId);
    const buffer = await this.productsExportService.generateProductsPdf(products);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="produits-magasin-${storeId}.pdf"`,
    });
    res.send(buffer);
  }
}