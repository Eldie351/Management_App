import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  async findAll(@Query('storeId') storeId?: string) {
    return this.receiptsService.findAll(storeId);
  }

  @Get('store/:storeId')
  async findByStore(@Param('storeId') storeId: string) {
    return this.receiptsService.findAll(storeId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.receiptsService.findOne(id);
  }
}
