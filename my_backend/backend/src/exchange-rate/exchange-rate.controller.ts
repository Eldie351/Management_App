import { Controller, Get, Post, Query } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';

@Controller('api/exchange-rates')
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
  async refreshExchangeRates() {
    await this.exchangeRateService.fetchAndCacheExchangeRates();
    return { message: 'Exchange rates refreshed successfully' };
  }
}
