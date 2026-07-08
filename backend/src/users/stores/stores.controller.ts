import { Body, Controller, Post, Get, Delete, Patch, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StoresService } from './stores.service';
import { Currency, UserRole } from '@prisma/client';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const { ADMIN } = UserRole;

@Controller('stores')
@UseGuards(AuthGuard('jwt'), RolesGuard)
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

  // "Paramètres magasin" : ADMIN uniquement.
  @Patch(':id')
  @Roles(ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; location?: string; currency?: string },
  ) {
    return this.storesService.updateStore(id, {
      name: body.name,
      location: body.location,
      currency: body.currency as Currency,
    });
  }

  @Delete(':id')
  @Roles(ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.deleteStore(id);
  }

  @Get(':id/stats')
  async getStats(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.getStoreStats(id);
  }
}
