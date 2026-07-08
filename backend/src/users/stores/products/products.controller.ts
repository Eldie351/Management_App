import { Body, Controller, Post, Get, Delete, Request, Patch, Param, ParseIntPipe, UseGuards, Query, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsExportService } from './export/products-export.service';

const { ADMIN, MANAGER } = UserRole;

@Controller('products')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsExportService: ProductsExportService,
  ) {}

  // --- Créer / modifier / supprimer -----------------------------------

  @Post()
  @Roles(ADMIN, MANAGER)
  async create(@Body() createProductDto: CreateProductDto, @Request() req) {
    return this.productsService.createProduct(createProductDto, req.user.id);
  }

  @Patch(':id')
  @Roles(ADMIN, MANAGER)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req,
  ) {
    return this.productsService.updateProduct(id, updateProductDto, req.user.id);
  }

  @Delete(':id')
  @Roles(ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.productsService.deleteProduct(id, req.user.id);
  }

  // --- Consultation (ouverte aux 3 rôles) ------------------------------

  @Get('low-stock')
  async getLowStock(@Request() req, @Query('storeId') storeId?: string) {
    return this.productsService.findLowStock(req.user.id, storeId ? parseInt(storeId, 10) : undefined);
  }

  @Get('out-of-stock')
  async getOutOfStock(@Request() req, @Query('storeId') storeId?: string) {
    return this.productsService.findOutOfStock(req.user.id, storeId ? parseInt(storeId, 10) : undefined);
  }

  @Get(':id/details')
  async getDetails(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getProductDetails(id);
  }

  @Get('store/:storeId')
  async findByStore(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.productsService.findAllByStore(storeId);
  }

  @Get('user/all')
  async findAllByUser(@Request() req) {
    return this.productsService.findAllByUserId(req.user.id);
  }

  // --- Mouvements de stock ----------------------------------------------

  @Get('store/:storeId/movements')
  @Roles(ADMIN, MANAGER)
  async getMovements(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.productsService.getStockMovements(storeId);
  }

  @Patch(':id/recharge')
  @Roles(ADMIN, MANAGER)
  async rechargeStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantity', ParseIntPipe) quantity: number,
    @Request() req,
  ) {
    return this.productsService.rechargeProduct(id, quantity, req.user.id);
  }

  @Patch(':id/adjust')
  @Roles(ADMIN, MANAGER)
  async adjustStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('delta', ParseIntPipe) delta: number,
    @Body('note') note: string,
    @Request() req,
  ) {
    return this.productsService.adjustProduct(id, delta, req.user.id, note);
  }

  // --- Ventes -------------------------------------------------------------

  // "Enregistrer vente" : ouvert aux 3 rôles.
  @Patch(':id/stock')
  async updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantity', ParseIntPipe) quantity: number,
    @Request() req,
  ) {
    return this.productsService.sellProduct(id, quantity, req.user.id);
  }

  // "Voir toutes les ventes" (ADMIN/MANAGER) vs "Voir ses ventes" (CASHIER) :
  // même route, filtrage appliqué dans le service selon le rôle.
  @Get('store/:storeId/sales')
  async getStoreSales(@Param('storeId', ParseIntPipe) storeId: number, @Request() req) {
    return this.productsService.findSalesByStore(storeId, req.user.id, req.user.role);
  }

  // --- Export PDF / Excel --------------------------------------------------

  @Get('store/:storeId/export/excel')
  @Roles(ADMIN, MANAGER)
  async exportExcel(@Param('storeId', ParseIntPipe) storeId: number, @Res() res: Response) {
    const products = await this.productsService.findAllByStore(storeId);
    const buffer = await this.productsExportService.generateProductsExcel(products);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="produits-magasin-${storeId}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('store/:storeId/export/pdf')
  @Roles(ADMIN, MANAGER)
  async exportPdf(@Param('storeId', ParseIntPipe) storeId: number, @Res() res: Response) {
    const products = await this.productsService.findAllByStore(storeId);
    const buffer = await this.productsExportService.generateProductsPdf(products);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="produits-magasin-${storeId}.pdf"`,
    });
    res.send(buffer);
  }
}
