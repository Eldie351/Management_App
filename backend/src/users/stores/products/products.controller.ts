import { Body, Controller, Post, Get, Delete, Request, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common'; // <-- LE MOT "Patch" EST BIEN PRÉSENT ICI
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
@UseGuards(AuthGuard('jwt'))
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async create(@Body() createProductDto: CreateProductDto, @Request() req) {
    return this.productsService.createProduct(createProductDto, req.user.id);
  }

  @Get(':id/details')
  async getDetails(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getProductDetails(id);
  }

  @Get('store/:storeId/movements')
  async getMovements(
    @Param('storeId', ParseIntPipe) storeId: number,
  ) {
    return this.productsService.getStockMovements(storeId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(id, updateProductDto);
  }

  @Get('store/:storeId')
  async findByStore(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.productsService.findAllByStore(storeId);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deleteProduct(id);
  }

  @Get('store/:storeId/sales')
  async getStoreSales(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.productsService.findSalesByStore(storeId);
  }

  @Get('user/all')
  async findAllByUser(@Request() req) {
    const userId = req.user.id; // Extrait l'ID utilisateur réel depuis le Token
    return this.productsService.findAllByUserId(userId);
  }

  @Patch(':id/recharge')
  async rechargeStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantity', ParseIntPipe) quantity: number,
    @Request() req,
  ) {
    return this.productsService.rechargeProduct(id, quantity, req.user.id);
  }

  @Patch(':id/stock')
  async updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantity', ParseIntPipe) quantity: number,
    @Request() req,
  ) {
    return this.productsService.sellProduct(id, quantity, req.user.id);
  }

  @Patch(':id/adjust')
  async adjustStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('delta', ParseIntPipe) delta: number,
    @Body('note') note: string,
    @Request() req,
  ) {
    return this.productsService.adjustProduct(id, delta, req.user.id, note);
  }
}
