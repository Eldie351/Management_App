import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';

@Injectable()
export class ExchangeRateCronService implements OnModuleInit {
  private readonly logger = new Logger(ExchangeRateCronService.name);
  private cronInterval: NodeJS.Timeout | null = null;

  constructor(private exchangeRateService: ExchangeRateService) {}

  async onModuleInit() {
    this.logger.log('🚀 Initializing Exchange Rate Cron Service...');
    
    // Fetch rates immediately on startup
    try {
      await this.exchangeRateService.fetchAndCacheExchangeRates();
    } catch (error) {
      this.logger.error('Failed to fetch exchange rates on startup:', error);
    }

    // Schedule automatic updates every 6 hours
    this.scheduleCronJob();
  }

  private scheduleCronJob() {
    // 6 hours in milliseconds
    const SIX_HOURS = 6 * 60 * 60 * 1000;

    this.cronInterval = setInterval(async () => {
      try {
        this.logger.log('⏱️ Running scheduled exchange rate update...');
        await this.exchangeRateService.fetchAndCacheExchangeRates();
      } catch (error) {
        this.logger.error('Scheduled exchange rate update failed:', error);
      }
    }, SIX_HOURS);

    this.logger.log('✅ Cron job scheduled: Updates every 6 hours');
  }

  onModuleDestroy() {
    if (this.cronInterval) {
      clearInterval(this.cronInterval);
      this.logger.log('Cron job cancelled');
    }
  }
}
