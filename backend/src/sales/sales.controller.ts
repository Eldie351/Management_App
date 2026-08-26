import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  /**
   * Helper privé pour vérifier si l'utilisateur a accès aux ventes d'un magasin donné
   */
  private checkStoreAccess(user: any, storeId: number) {
    if (user?.role === UserRole.ADMIN) return;

    // Extraire tous les IDs de magasins autorisés (assigné, possédés et rattachés)
    const allowedStoreIds = [
      user?.assignedStoreId,
      ...(user?.ownedStores?.map((s: any) => s.id ?? s) ?? []),
      ...(user?.storeAssignments?.map((a: any) => a.storeId ?? a.store?.id ?? a) ?? []),
      ...(user?.stores?.map((s: any) => s.id ?? s) ?? []), // Sécurité si `stores` est présent
    ]
      .map(Number)
      .filter((id) => !isNaN(id) && id > 0);

    const targetStoreId = Number(storeId);

    if (!allowedStoreIds.includes(targetStoreId)) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à effectuer une vente dans ce magasin.",
      );
    }
  }

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
    this.checkStoreAccess(user, createSaleDto.storeId);
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
    this.checkStoreAccess(user, storeId);
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
    this.checkStoreAccess(user, sale.storeId);

    return sale;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    const sale = await this.salesService.findOne(id);
    this.checkStoreAccess(user, sale.storeId);

    await this.salesService.deleteSale(id, user.id);
    return { message: 'Facture supprimée avec succès.' };
  }
}