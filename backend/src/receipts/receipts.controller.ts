import { Controller, Get, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { assertStoreAccess, getAllowedStoreIds } from '../common/utils/store-access.util';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('receipts')
@Roles(UserRole.CASHIER, UserRole.MANAGER, UserRole.ADMIN)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  async findAll(
    @Query('storeId') storeId: string | undefined,
    @Query('start') start: string | undefined,
    @Query('end') end: string | undefined,
    @CurrentUser() user: any,
  ) {
    // BUGFIX (critique) : l'ancienne version laissait un ADMIN filtrer sur
    // N'IMPORTE QUEL storeId, et surtout — sans storeId du tout — appelait
    // `receiptsService.findAll(undefined, ...)`, ce qui renvoyait TOUS les
    // reçus de TOUS les commerces de l'application. On restreint maintenant
    // toujours aux magasins réellement possédés/assignés de l'utilisateur.
    const allowedStoreIds = getAllowedStoreIds(user);

    if (storeId) {
      assertStoreAccess(user, storeId, "Vous n'avez pas accès aux reçus de ce magasin.");
      return this.receiptsService.findAll(Number(storeId), start, end);
    }

    return this.receiptsService.findAllForStores(allowedStoreIds, start, end);
  }

  @Get('store/:storeId')
  async findByStore(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('start') start: string | undefined,
    @Query('end') end: string | undefined,
    @CurrentUser() user: any,
  ) {
    // BUGFIX : ne vérifiait que `user.assignedStoreId`, ignorant les
    // magasins secondaires (`storeAssignments`) et laissant passer tout
    // ADMIN sans vérifier qu'il possède bien ce magasin.
    assertStoreAccess(user, storeId, "Vous n'avez pas accès aux reçus de ce magasin.");
    return this.receiptsService.findAll(storeId, start, end);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    const receipt = await this.receiptsService.findOne(id);
    assertStoreAccess(user, receipt.storeId, "Vous n'avez pas accès à ce reçu.");
    return receipt;
  }
}
