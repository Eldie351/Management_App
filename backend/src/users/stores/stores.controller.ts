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
  BadRequestException,
  ForbiddenException,
  DefaultValuePipe,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { Currency, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  /**
   * Créer un magasin : ADMIN uniquement.
   */
  @Post()
  @Roles(UserRole.ADMIN)
  async create(
    @CurrentUser('id') userId: number,
    @Body() createStoreDto: CreateStoreDto,
  ) {
    return this.storesService.createStore(
      userId,
      createStoreDto.name,
      createStoreDto.location,
      createStoreDto.phone,
      createStoreDto.currency,
    );
  }

  /**
   * Liste des magasins accessibles selon le rôle.
   * Retourne toujours un tableau (Array) pour la cohérence REST.
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findAll(@CurrentUser() user: any) {
    // L'ADMIN voit tous les magasins qu'il possède/gère
    if (user.role === UserRole.ADMIN) {
      return this.storesService.findAllByUser(user.id);
    }

    // Le MANAGER ou CASHIER ne voit que son magasin assigné (encapsulé dans un tableau)
    if (user.assignedStoreId) {
      const store = await this.storesService.findOne(user.assignedStoreId);
      return store ? [store] : [];
    }

    return [];
  }

  /**
   * Consulter un magasin spécifique par son ID.
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== id) {
      throw new ForbiddenException(
        "Vous n'avez pas accès aux détails de ce magasin.",
      );
    }
    return this.storesService.findOne(id);
  }

  /**
   * Modifier les paramètres d'un magasin : ADMIN uniquement.
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; location?: string; phone?: string; currency?: Currency },
  ) {
    return this.storesService.updateStore(id, {
      name: body.name,
      location: body.location,
      phone: body.phone,
      currency: body.currency,
    });
  }

  /**
   * Supprimer un magasin : ADMIN uniquement.
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.deleteStore(id);
  }

  /**
   * Statistiques financières d'un magasin : ADMIN & MANAGER.
   */
  @Get(':id/stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStats(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    // Sécurité : Un Manager ne peut pas consulter les stats d'un autre magasin
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== id) {
      throw new ForbiddenException(
        "Vous n'avez pas la permission de consulter les statistiques de ce magasin.",
      );
    }

    return this.storesService.getStoreStats(id);
  }

  /**
   * Détail des ventes par période : ADMIN & MANAGER.
   */
  @Get(':id/stats/period-sales')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStatsPeriodSales(
    @Param('id', ParseIntPipe) id: number,
    @Query('period') period: string,
    @Query('index', new DefaultValuePipe(0), ParseIntPipe) index: number,
    @CurrentUser() user: any,
  ) {
    // Sécurité : Vérification de l'affectation du Manager
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== id) {
      throw new ForbiddenException(
        "Vous n'avez pas accès à ces données statistiques.",
      );
    }

    if (period !== 'weekly' && period !== 'monthly' && period !== 'yearly') {
      throw new BadRequestException(
        "Le paramètre 'period' doit être 'weekly', 'monthly' ou 'yearly'.",
      );
    }

    return this.storesService.getSalesForPeriod(id, period, index);
  }
}