import { Body, Controller, Post, Get, Delete, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';

@Controller('stores')
@UseGuards(AuthGuard('jwt'))
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  async create(@Body() createStoreDto: CreateStoreDto, @Request() req) {
    const userId = req.user.id; 

    return this.storesService.createStore(
      userId,
      createStoreDto.name,
      createStoreDto.location,
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.deleteStore(id);
  }

    @Get(':id/stats')
  async getStats(@Param('id', ParseIntPipe) id: number) {
    // 🔍 SCRIPT DE DIAGNOSTIC LOGISTIQUE
    console.log(`============= ANALYSE DU MAGASIN ID #${id} =============`);
    
    const statsResult = await this.storesService.getStoreStats(id);
    
    console.log(`-> Nombre de ventes trouvées en base PostgreSQL pour ce magasin : ${statsResult.summary.unitsSold}`);
    console.log(`-> Chiffre d'Affaires calculé par le service : ${statsResult.summary.totalRevenue} €`);
    console.log(`========================================================`);

    return statsResult;
  }

  @Get('user/:userId')
  async findAllByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.storesService.findAllByUser(userId);
  }
}
