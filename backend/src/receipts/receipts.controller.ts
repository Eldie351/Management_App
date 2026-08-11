import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  async findAll(@Query('storeId') storeId?: string) {
    return this.receiptsService.findAll(storeId ? Number(storeId) : undefined);
  }

  @Get('store/:storeId')
  async findByStore(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.receiptsService.findAll(storeId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.receiptsService.findOne(id);
  }
}