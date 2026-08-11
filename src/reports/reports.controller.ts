import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('kpis')
  async getKpis(@Query('start') start: string, @Query('end') end: string) {
    if (!start || !end) throw new BadRequestException('start and end are required');
    return this.reportsService.getKpis(start, end);
  }

  @Get('sales/series')
  async getSalesSeries(@Query('period') period: string, @Query('start') start: string, @Query('end') end: string) {
    if (!period || !start || !end) throw new BadRequestException('period, start and end are required');
    return this.reportsService.getSalesSeries(period as any, start, end);
  }

  @Get('sales/day')
  async getSalesDay(@Query('date') date: string) {
    if (!date) throw new BadRequestException('date is required');
    return this.reportsService.getSalesDay(date);
  }

  @Get('stores')
  async getStoresPerf(@Query('start') start: string, @Query('end') end: string) {
    if (!start || !end) throw new BadRequestException('start and end are required');
    return this.reportsService.getStoresPerf(start, end);
  }
}
