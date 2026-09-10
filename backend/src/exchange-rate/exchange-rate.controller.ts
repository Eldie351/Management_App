import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ExchangeRateService } from './exchange-rate.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/exchange-rates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  /**
   * Get all cached exchange rates
   */
  @Get()
  async getAllExchangeRates() {
    return this.exchangeRateService.getAllExchangeRates();
  }

  /**
   * Get specific exchange rate
   */
  @Get('info')
  async getExchangeRateInfo(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.exchangeRateService.getExchangeRateInfo(from, to);
  }

  /**
   * Convert amount from one currency to another
   */
  @Get('convert')
  async convert(
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.exchangeRateService.convert(parseFloat(amount), from, to);
  }

  /**
   * Manually trigger exchange rate update
   */
  @Post('refresh')
  @Roles(UserRole.ADMIN)
  async refreshExchangeRates() {
    await this.exchangeRateService.fetchAndCacheExchangeRates();
    return { message: 'Exchange rates refreshed successfully' };
  }
}
