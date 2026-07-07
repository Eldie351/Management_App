import { Body, Controller, Post, Get, Delete, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StoresService } from './stores.service';
import { Currency } from '@prisma/client';

@Controller('stores')
@UseGuards(AuthGuard('jwt'))
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  async create(
    @Request() req, 
    @Body() body: { name: string; location?: string; currency?: string }
  ) {
    const userId = req.user.id;
    return this.storesService.createStore(
      userId, 
      body.name, 
      body.location, 
      body.currency as Currency
    );
  }

  @Get()
  async findAll(@Request() req) {
    const userId = req.user.id;
    return this.storesService.findAllByUser(userId);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.deleteStore(id);
  }

  @Get(':id/stats')
  async getStats(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.getStoreStats(id);
  }
}