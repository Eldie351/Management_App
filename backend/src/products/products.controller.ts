import { Body, Controller, Post, Get, Delete, Request, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common'; // <-- LE MOT "Patch" EST BIEN PRÉSENT ICI
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('products')
@UseGuards(AuthGuard('jwt'))
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.createProduct(createProductDto);
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
  ) {
    return this.productsService.rechargeProduct(id, quantity);
  }

  @Patch(':id/stock')
  async updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantity', ParseIntPipe) quantity: number,
  ) {
    return this.productsService.sellProduct(id, quantity);
  }
}
