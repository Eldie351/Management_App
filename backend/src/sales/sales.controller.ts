import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { assertStoreAccess } from '../common/utils/store-access.util';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  /**
   * Enregistrer une vente et délivrer une facture.
   * Accessible aux Caissiers, Managers et Admins.
   */
  @Post()
  @Roles(UserRole.CASHIER, UserRole.MANAGER, UserRole.ADMIN)
  async createSale(
    @CurrentUser() user: any,
    @Body() createSaleDto: CreateSaleDto,
  ) {
    // BUGFIX : le contrôle d'accès local laissait passer n'importe quel
    // ADMIN sur n'importe quel magasin (voir SalesService.createSale, qui a
    // le même bug corrigé côté service pour la double-sécurité).
    assertStoreAccess(
      user,
      createSaleDto.storeId,
      "Vous n'êtes pas autorisé à effectuer une vente dans ce magasin.",
    );
    return this.salesService.createSale(user.id, createSaleDto);
  }

  /**
   * Historique global des ventes d'un magasin.
   * Accessible aux Caissiers, Managers et Admins.
   */
  @Get('store/:storeId')
  @Roles(UserRole.CASHIER, UserRole.MANAGER, UserRole.ADMIN)
  async findAllByStore(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: any,
  ) {
    assertStoreAccess(user, storeId, "Vous n'avez pas accès aux ventes de ce magasin.");
    return this.salesService.findAllByStore(storeId);
  }

  /**
   * Consulter / imprimer une facture précise.
   * Accessible aux Caissiers, Managers et Admins.
   */
  @Get(':id')
  @Roles(UserRole.CASHIER, UserRole.MANAGER, UserRole.ADMIN)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    const sale = await this.salesService.findOne(id);
    assertStoreAccess(user, sale.storeId, "Vous n'avez pas accès à cette facture.");

    return sale;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    const sale = await this.salesService.findOne(id);
    assertStoreAccess(user, sale.storeId, "Vous n'avez pas accès à cette facture.");

    await this.salesService.deleteSale(id, user.id);
    return { message: 'Facture supprimée avec succès.' };
  }
}
