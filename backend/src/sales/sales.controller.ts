import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { DeleteSaleDto } from './dto/delete-sale.dto';
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
   * Historique des modifications / suppressions de reçus (motif, auteur,
   * date, signalement validé). Réservé à l'ADMIN.
   * `storeId` optionnel : sans lui, tous les magasins de l'utilisateur.
   */
  @Get('actions')
  @Roles(UserRole.ADMIN)
  async findReceiptActions(@CurrentUser() user: any, @Query('storeId') storeId?: string) {
    if (storeId) {
      assertStoreAccess(user, storeId, "Vous n'avez pas accès à ce magasin.");
    }
    return this.salesService.findReceiptActions(user, storeId ? Number(storeId) : undefined);
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

  /**
   * Modifier entièrement un reçu déjà émis (articles, quantités, prix,
   * remise, client, mode de paiement). Réservé à l'ADMIN, motif obligatoire
   * (voir UpdateSaleDto / SalesService.updateSale).
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSaleDto: UpdateSaleDto,
    @CurrentUser() user: any,
  ) {
    const sale = await this.salesService.findOne(id);
    assertStoreAccess(user, sale.storeId, "Vous n'avez pas accès à cette facture.");

    return this.salesService.updateSale(id, updateSaleDto, user.id);
  }

  /**
   * Supprimer (annuler) un reçu : le stock est restauré. Réservé à l'ADMIN,
   * motif obligatoire, consigné dans le journal d'audit.
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Body() deleteSaleDto: DeleteSaleDto,
    @CurrentUser() user: any,
  ) {
    const sale = await this.salesService.findOne(id);
    assertStoreAccess(user, sale.storeId, "Vous n'avez pas accès à cette facture.");

    await this.salesService.deleteSale(id, deleteSaleDto, user.id);
    return { message: 'Facture supprimée avec succès.' };
  }
}
