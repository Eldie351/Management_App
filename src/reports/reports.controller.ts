import {
  Controller,
  Get,
  Query,
  BadRequestException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
   * Extrait tous les IDs de magasins autorisés de façon robuste depuis le JWT / User context
   */
  private extractAllowedStoreIds(user: any): number[] {
    if (!user) return [];

    const rawIds = [
      user.assignedStoreId,
      ...(user.ownedStoreIds || user.ownedStores?.map((s: any) => s.id ?? s) || []),
      ...(user.assignedStoreIds || user.storeAssignments?.map((a: any) => a.storeId ?? a.store?.id ?? a) || []),
    ];

    return Array.from(
      new Set(
        rawIds
          .map((id) => Number(id))
          .filter((id): id is number => !isNaN(id) && id > 0),
      ),
    );
  }

  /**
   * Vérifie l'accès d'un utilisateur non-admin à un magasin donné.
   */
  private checkStoreAccess(user: any, storeId: number) {
    if (user?.role === UserRole.ADMIN) return;

    const allowedStoreIds = this.extractAllowedStoreIds(user);
    const targetStoreId = Number(storeId);

    if (!allowedStoreIds.includes(targetStoreId)) {
      throw new ForbiddenException(
        "Vous n'avez pas accès aux rapports de ce magasin.",
      );
    }
  }

  /**
   * Résout le storeId demandé :
   * - Si spécifié : vérifie les droits et renvoie l'ID.
   * - Si non spécifié : renvoie undefined (le ReportsService filtrera par la liste des magasins autorisés de user).
   */
  private resolveStoreId(user: any, queryStoreId?: string): number | undefined {
    const parsedQueryId = this.parseNumber(queryStoreId);

    if (parsedQueryId !== undefined) {
      this.checkStoreAccess(user, parsedQueryId);
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