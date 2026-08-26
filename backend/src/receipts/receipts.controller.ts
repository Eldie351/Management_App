import { Controller, Get, Param, Query, ParseIntPipe, UseGuards, ForbiddenException } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
    // Un CASHIER/MANAGER est cantonné à son magasin assigné, quel que soit
    // le storeId passé en query. Un ADMIN peut filtrer sur n'importe quel magasin.
    const resolvedStoreId =
      user.role !== UserRole.ADMIN ? (user.assignedStoreId ?? undefined) : storeId ? Number(storeId) : undefined;
    return this.receiptsService.findAll(resolvedStoreId, start, end);
  }

  @Get('store/:storeId')
  async findByStore(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('start') start: string | undefined,
    @Query('end') end: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== storeId) {
      throw new ForbiddenException("Vous n'avez pas accès aux reçus de ce magasin.");
    }
    return this.receiptsService.findAll(storeId, start, end);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    const receipt = await this.receiptsService.findOne(id);
    if (user.role !== UserRole.ADMIN && user.assignedStoreId !== receipt.storeId) {
      throw new ForbiddenException("Vous n'avez pas accès à ce reçu.");
    }
    return receipt;
  }
}