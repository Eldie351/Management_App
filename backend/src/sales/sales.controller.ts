import {
  Controller,
  Post,
  Get,
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
   * Enregistrer une vente et délivrer une facture.
   * Accessible aux Caissiers, Managers et Admins.
   */
  @Post()
  @Roles(UserRole.CASHIER, UserRole.MANAGER, UserRole.ADMIN)
  async createSale(
    @CurrentUser() user: any,
    @Body() createSaleDto: CreateSaleDto,
  ) {
    // Sécurité : Un Caissier ou Manager ne peut enregistrer une vente QUE dans son magasin assigné
    if (
      user.role !== UserRole.ADMIN &&
      user.assignedStoreId !== createSaleDto.storeId
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez effectuer de vente que dans votre magasin assigné.',
      );
    }

    return this.salesService.createSale(user.id, createSaleDto);
  }

  /**
   * Historique global des ventes d'un magasin.
   * Accessible aux Managers et Admins uniquement.
   */
  @Get('store/:storeId')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  async findAllByStore(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: any,
  ) {
    // Sécurité : Un Manager ne peut pas consulter les ventes d'un autre magasin
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== storeId) {
      throw new ForbiddenException(
        'Vous n\'avez pas accès aux ventes de ce magasin.',
      );
    }

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

    // Sécurité : Vérifier que la facture appartient au magasin de l'employé
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== sale.storeId) {
      throw new ForbiddenException(
        'Vous n\'avez pas accès à cette facture.',
      );
    }

    return sale;
  }
}