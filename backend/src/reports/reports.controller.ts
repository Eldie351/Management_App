import { Controller, Get, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Un MANAGER est toujours cantonné à son magasin assigné, quel que soit
   * le storeId passé en query. Un ADMIN peut filtrer sur n'importe quel
   * magasin (ou aucun -> toutes stores confondues).
   */
  private resolveStoreId(user: any, queryStoreId?: string): number | undefined {
    if (user.role !== UserRole.ADMIN) {
      return user.assignedStoreId ?? undefined;
    }
    return queryStoreId ? Number(queryStoreId) : undefined;
  }

  @Get('kpis')
  async getKpis(
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('storeId') storeId: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!start || !end) throw new BadRequestException('start et end sont requis');
    return this.reportsService.getKpis(start, end, this.resolveStoreId(user, storeId));
  }

  // Alias conservés pour compat frontend : /sales-series et /sales/series
  @Get(['sales-series', 'sales/series'])
  async getSalesSeries(
    @Query('period') period: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('storeId') storeId: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!period || !start || !end) {
      throw new BadRequestException('period, start et end sont requis');
    }
    if (!['week', 'month', 'year'].includes(period)) {
      throw new BadRequestException('period doit être week, month ou year');
    }
    return this.reportsService.getSalesSeries(
      period as 'week' | 'month' | 'year',
      start,
      end,
      this.resolveStoreId(user, storeId),
    );
  }

  @Get('sales/day')
  async getSalesDay(
    @Query('date') date: string,
    @Query('storeId') storeId: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!date) throw new BadRequestException('date est requis');
    return this.reportsService.getSalesDay(date, this.resolveStoreId(user, storeId));
  }

  // Alias conservés pour compat frontend : /stores-perf, /stores/performance et /stores
  @Get(['stores-perf', 'stores/performance', 'stores'])
  async getStoresPerf(
    @Query('start') start: string,
    @Query('end') end: string,
    @CurrentUser() user: any,
  ) {
    if (!start || !end) throw new BadRequestException('start et end sont requis');
    // La répartition par magasin n'a de sens que pour un ADMIN (vue multi-magasins).
    // Un MANAGER reçoit uniquement la part de son propre magasin.
    const storeId = user.role !== UserRole.ADMIN ? (user.assignedStoreId ?? undefined) : undefined;
    return this.reportsService.getStoresPerf(start, end, storeId);
  }
}
