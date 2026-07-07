import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly apiKey: string;
  private readonly apiUrls = [
    'https://openexchangerates.org/api/latest',
    'https://api.exchangerate.host/latest',
  ];
  private readonly fallbackRates: Record<string, number> = {
    XOF: 600,
    EUR: 0.92,
    GBP: 0.79,
    NGN: 1600,
  };

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>('OPENEXCHANGERATES_API_KEY') || 'free';
  }

  async fetchAndCacheExchangeRates(): Promise<void> {
    try {
      this.logger.log('Fetching exchange rates from the configured API...');

      let rates: Record<string, number> | null = null;

      for (const baseUrl of this.apiUrls) {
        try {
          const url = baseUrl.includes('openexchangerates')
            ? `${baseUrl}?app_id=${this.apiKey}&base=USD&symbols=XOF,EUR,GBP,NGN`
            : `${baseUrl}?base=USD&symbols=XOF,EUR,GBP,NGN`;

          const response = await fetch(url);
          if (!response.ok) {
            continue;
          }

          const data = (await response.json()) as any;
          if (data?.rates) {
            rates = data.rates as Record<string, number>;
            break;
          }
        } catch (error) {
          this.logger.warn(`Exchange-rate provider failed for ${baseUrl}: ${String(error)}`);
        }
      }

      if (!rates) {
        this.logger.warn('Using fallback exchange rates because the external API is unavailable.');
        rates = this.fallbackRates;
      }

      // Store rates in database
      for (const [targetCurrency, rate] of Object.entries(rates)) {
        const rateValue = Number(rate);

        // USD to target currency
        await this.prisma.exchangeRate.upsert({
          where: {
            fromCurrency_toCurrency: {
              fromCurrency: 'USD',
              toCurrency: targetCurrency,
            },
          },
          update: {
            rate: rateValue,
            lastUpdated: new Date(),
          },
          create: {
            fromCurrency: 'USD',
            toCurrency: targetCurrency,
            rate: rateValue,
            source: 'OPENEXCHANGERATES',
          },
        });

        // Reverse: target currency to USD
        const reverseRate = 1 / rateValue;
        await this.prisma.exchangeRate.upsert({
          where: {
            fromCurrency_toCurrency: {
              fromCurrency: targetCurrency,
              toCurrency: 'USD',
            },
          },
          update: {
            rate: reverseRate,
            lastUpdated: new Date(),
          },
          create: {
            fromCurrency: targetCurrency,
            toCurrency: 'USD',
            rate: reverseRate,
            source: 'OPENEXCHANGERATES',
          },
        });
      }

      // Cross-currency rates
      const currencies = ['XOF', 'EUR', 'USD', 'GBP', 'NGN'];
      for (let i = 0; i < currencies.length; i++) {
        for (let j = i + 1; j < currencies.length; j++) {
          const fromCurr = currencies[i];
          const toCurr = currencies[j];

          const rate1 = await this.getExchangeRateFromDB('USD', fromCurr);
          const rate2 = await this.getExchangeRateFromDB('USD', toCurr);

          if (rate1 && rate2) {
            const crossRate = rate2 / rate1;

            await this.prisma.exchangeRate.upsert({
              where: {
                fromCurrency_toCurrency: {
                  fromCurrency: fromCurr,
                  toCurrency: toCurr,
                },
              },
              update: {
                rate: crossRate,
                lastUpdated: new Date(),
              },
              create: {
                fromCurrency: fromCurr,
                toCurrency: toCurr,
                rate: crossRate,
                source: 'OPENEXCHANGERATES',
              },
            });

            const reverseRate = 1 / crossRate;
            await this.prisma.exchangeRate.upsert({
              where: {
                fromCurrency_toCurrency: {
                  fromCurrency: toCurr,
                  toCurrency: fromCurr,
                },
              },
              update: {
                rate: reverseRate,
                lastUpdated: new Date(),
              },
              create: {
                fromCurrency: toCurr,
                toCurrency: fromCurr,
                rate: reverseRate,
                source: 'OPENEXCHANGERATES',
              },
            });
          }
        }
      }

      this.logger.log('... Exchange rates cached successfully');
    } catch (error) {
      this.logger.warn('Using fallback exchange rates because the update failed.', error);
    }
  }

  private async getExchangeRateFromDB(from: string, to: string): Promise<number | null> {
    const rate = await this.prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to },
      },
    });
    return rate?.rate ? Number(rate.rate) : null;
  }

  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{ convertedAmount: number; rate: number; lastUpdated: Date }> {
    if (fromCurrency === toCurrency) {
      return { convertedAmount: amount, rate: 1, lastUpdated: new Date() };
    }

    const exchangeRate = await this.prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency: { fromCurrency, toCurrency },
      },
    });

    if (!exchangeRate) {
      throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    }

    const rate = Number(exchangeRate.rate);
    const convertedAmount = amount * rate;

    return {
      convertedAmount,
      rate,
      lastUpdated: exchangeRate.lastUpdated,
    };
  }

  async getAllExchangeRates() {
    return this.prisma.exchangeRate.findMany({
      orderBy: { lastUpdated: 'desc' },
    });
  }

  async getExchangeRateInfo(from: string, to: string) {
    return this.prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to },
      },
    });
  }
}