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
  DefaultValuePipe,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { Currency, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { assertStoreAccess } from '../../common/utils/store-access.util';

// Alias tolérés en entrée -> valeur canonique attendue par StoresService.
const PERIOD_ALIASES: Record<string, 'week' | 'month' | 'year'> = {
  week: 'week',
  weekly: 'week',
  month: 'month',
  monthly: 'month',
  year: 'year',
  yearly: 'year',
};

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
   * Liste des magasins accessibles selon le rôle (déjà scopée par
   * StoresService.findAllByUser : magasins possédés pour un ADMIN, magasins
   * assignés pour MANAGER/CASHIER).
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findAll(@CurrentUser() user: any) {
    return this.storesService.findAllByUser(user);
  }

  /**
   * Consulter un magasin spécifique par son ID.
   * BUGFIX : un ADMIN doit posséder ce magasin, pas seulement être ADMIN
   * de N'IMPORTE QUEL commerce (assertStoreAccess ne fait plus de passe-droit).
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    assertStoreAccess(user, id, "Vous n'avez pas la permission d'accéder à ce magasin.");
    return this.storesService.findOne(id);
  }

  /**
   * Modifier les paramètres d'un magasin : ADMIN, et uniquement SON magasin.
   * BUGFIX : avant, n'importe quel ADMIN pouvait modifier le magasin de
   * n'importe quel autre commerce (aucune vérification de propriété).
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; location?: string; phone?: string; currency?: Currency },
    @CurrentUser() user: any,
  ) {
    assertStoreAccess(user, id, "Vous n'avez pas la permission de modifier ce magasin.");
    return this.storesService.updateStore(id, {
      name: body.name,
      location: body.location,
      phone: body.phone,
      currency: body.currency,
    });
  }

  /**
   * Supprimer un magasin : ADMIN, et uniquement SON magasin.
   * BUGFIX : même faille que ci-dessus — n'importe quel ADMIN pouvait
   * supprimer le magasin (et donc toutes ses données) d'un autre commerce.
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    assertStoreAccess(user, id, "Vous n'avez pas la permission de supprimer ce magasin.");
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
    assertStoreAccess(user, id);
    return this.storesService.getStoreStats(id);
  }

  /**
   * Détail des ventes par période : ADMIN & MANAGER.
   * BUGFIX : la validation acceptait 'weekly'/'monthly'/'yearly' alors que
   * StoresService.getSalesForPeriod n'a jamais géré que 'week'/'month'/'year'
   * (et 'day'/'today') — cet endpoint renvoyait donc TOUJOURS une erreur 400,
   * quelle que soit la valeur envoyée. On normalise maintenant les deux formes.
   */
  @Get(':id/stats/period-sales')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStatsPeriodSales(
    @Param('id', ParseIntPipe) id: number,
    @Query('period') period: string,
    @Query('index', new DefaultValuePipe(0), ParseIntPipe) index: number,
    @CurrentUser() user: any,
  ) {
    assertStoreAccess(user, id);

    const normalizedPeriod = PERIOD_ALIASES[(period || '').toLowerCase()];
    if (!normalizedPeriod) {
      throw new BadRequestException(
        "Le paramètre 'period' doit être 'week', 'month' ou 'year' (les formes 'weekly'/'monthly'/'yearly' sont aussi acceptées).",
      );
    }

    return this.storesService.getSalesForPeriod(id, normalizedPeriod, index);
  }
}
