import {
  Controller,
  Get,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { assertStoreAccess } from '../common/utils/store-access.util';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Helper pour nettoyer les paramètres d'URL.
   * Transforme "undefined", "null", "" ou NaN en réel undefined.
   */
  private parseNumber(val?: any): number | undefined {
    if (val === undefined || val === null || val === '' || val === 'undefined' || val === 'null') {
      return undefined;
    }
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Résout le storeId demandé :
   * - Si spécifié : vérifie les droits (BUGFIX : plus de passe-droit ADMIN,
   *   voir common/utils/store-access.util.ts) et renvoie l'ID.
   * - Si non spécifié : renvoie undefined (le ReportsService filtrera par la
   *   liste des magasins autorisés de l'utilisateur).
   */
  private resolveStoreId(user: any, queryStoreId?: string): number | undefined {
    const parsedQueryId = this.parseNumber(queryStoreId);

    if (parsedQueryId !== undefined) {
      assertStoreAccess(user, parsedQueryId, "Vous n'avez pas accès aux rapports de ce magasin.");
      return parsedQueryId;
    }

    return undefined;
  }

  @Get('kpis')
  @Roles(UserRole.CASHIER, UserRole.ADMIN, UserRole.MANAGER)
  async getKpis(
    @Query('start') start?: string,
    @Query('startDate') startDate?: string,
    @Query('end') end?: string,
    @Query('endDate') endDate?: string,
    @Query('storeId') storeId?: string,
    @CurrentUser() user?: any,
  ) {
    const effectiveStart = start || startDate;
    const effectiveEnd = end || endDate;

    if (!effectiveStart || !effectiveEnd) {
      throw new BadRequestException('Les dates de début et de fin sont requises');
    }

    return this.reportsService.getKpis(
      effectiveStart,
      effectiveEnd,
      this.resolveStoreId(user, storeId),
      user,
    );
  }

  @Get(['sales-series', 'sales/series'])
  @Roles(UserRole.CASHIER, UserRole.ADMIN, UserRole.MANAGER)
  async getSalesSeries(
    @Query('period') period?: string,
    @Query('start') start?: string,
    @Query('startDate') startDate?: string,
    @Query('end') end?: string,
    @Query('endDate') endDate?: string,
    @Query('storeId') storeId?: string,
    @CurrentUser() user?: any,
  ) {
    const effectiveStart = start || startDate;
    const effectiveEnd = end || endDate;

    if (!period || !effectiveStart || !effectiveEnd) {
      throw new BadRequestException('Les paramètres period, start et end sont requis');
    }
    if (!['week', 'month', 'year'].includes(period)) {
      throw new BadRequestException('Le paramètre period doit être week, month ou year');
    }

    return this.reportsService.getSalesSeries(
      period as 'week' | 'month' | 'year',
      effectiveStart,
      effectiveEnd,
      this.resolveStoreId(user, storeId),
      user,
    );
  }

  @Get('sales/day')
  @Roles(UserRole.CASHIER, UserRole.ADMIN, UserRole.MANAGER)
  async getSalesDay(
    @Query('date') date?: string,
    @Query('storeId') storeId?: string,
    @CurrentUser() user?: any,
  ) {
    if (!date) {
      throw new BadRequestException('Le paramètre date est requis');
    }

    return this.reportsService.getSalesDay(
      date,
      this.resolveStoreId(user, storeId),
      user,
    );
  }

  @Get(['stores-perf', 'stores/performance'])
  @Roles(UserRole.CASHIER, UserRole.ADMIN, UserRole.MANAGER)
  async getStoresPerf(
    @Query('start') start?: string,
    @Query('startDate') startDate?: string,
    @Query('end') end?: string,
    @Query('endDate') endDate?: string,
    @Query('storeId') storeId?: string,
    @CurrentUser() user?: any,
  ) {
    const effectiveStart = start || startDate;
    const effectiveEnd = end || endDate;

    if (!effectiveStart || !effectiveEnd) {
      throw new BadRequestException('Les paramètres start et end sont requis');
    }

    return this.reportsService.getStoresPerf(
      effectiveStart,
      effectiveEnd,
      this.resolveStoreId(user, storeId),
      user,
    );
  }

  /**
   * Rapport quotidien par produit pour un ou plusieurs caissiers/managers.
   */
  @Get('cashiers/daily-products')
  @Roles(UserRole.CASHIER, UserRole.MANAGER, UserRole.ADMIN)
  async getCashierDailyProducts(
    @Query('start') start?: string,
    @Query('startDate') startDate?: string,
    @Query('end') end?: string,
    @Query('endDate') endDate?: string,
    @Query('storeId') storeId?: string,
    @Query('userId') userId?: string,
    @CurrentUser() user?: any,
  ) {
    const effectiveStart = start || startDate;
    const effectiveEnd = end || endDate;

    if (!effectiveStart || !effectiveEnd) {
      throw new BadRequestException('Les dates de début et de fin sont requises');
    }

    const resolvedStoreId = this.resolveStoreId(user, storeId);
    const filterCashierId = this.parseNumber(userId);

    return this.reportsService.getCashierDailyProducts(
      effectiveStart,
      effectiveEnd,
      resolvedStoreId,
      user,
      filterCashierId,
    );
  }
}
