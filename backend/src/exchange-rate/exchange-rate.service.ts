import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://openexchangerates.org/api/latest';

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>('OPENEXCHANGERATES_API_KEY') || 'free';
  }

  /**
   * Fetch exchange rates from the API and cache them in the database
   */
  async fetchAndCacheExchangeRates(): Promise<void> {
    try {
      this.logger.log('Fetching exchange rates from OpenExchangeRates API...');

      // Fetch rates for all supported currencies relative to USD
      const response = await fetch(
        `${this.apiUrl}?app_id=${this.apiKey}&base=USD&symbols=XOF,EUR,GBP,NGN`,
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      if (!data.rates) {
        throw new Error('No rates found in API response');
      }

      // Store rates in database
      for (const [targetCurrency, rate] of Object.entries(data.rates)) {
        // USD to target currency
        await this.prisma.exchangeRate.upsert({
          where: {
            fromCurrency_toCurrency: {
              fromCurrency: 'USD',
              toCurrency: targetCurrency as string,
            },
          },
          update: {
            rate: parseFloat(rate as any).toString(),
            lastUpdated: new Date(),
          },
          create: {
            fromCurrency: 'USD',
            toCurrency: targetCurrency as string,
            rate: parseFloat(rate as any).toString(),
            source: 'OPENEXCHANGERATES',
          },
        });

        // Reverse: target currency to USD
        const reverseRate = 1 / (rate as number);
        await this.prisma.exchangeRate.upsert({
          where: {
            fromCurrency_toCurrency: {
              fromCurrency: targetCurrency as string,
              toCurrency: 'USD',
            },
          },
          update: {
            rate: reverseRate.toString(),
            lastUpdated: new Date(),
          },
          create: {
            fromCurrency: targetCurrency as string,
            toCurrency: 'USD',
            rate: reverseRate.toString(),
            source: 'OPENEXCHANGERATES',
          },
        });
      }

      // Cross-currency rates (XOF to EUR, GBP, NGN, etc.)
      const currencies = ['XOF', 'EUR', 'USD', 'GBP', 'NGN'];
      for (let i = 0; i < currencies.length; i++) {
        for (let j = i + 1; j < currencies.length; j++) {
          const fromCurr = currencies[i];
          const toCurr = currencies[j];

          const rate1 = await this.getExchangeRateFromDB('USD', fromCurr);
          const rate2 = await this.getExchangeRateFromDB('USD', toCurr);

          if (rate1 && rate2) {
            const crossRate = (parseFloat(rate2) / parseFloat(rate1)).toString();

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

            const reverseRate = (1 / parseFloat(crossRate)).toString();
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

      this.logger.log('✅ Exchange rates cached successfully');
    } catch (error) {
      this.logger.error('Failed to fetch exchange rates:', error);
      throw error;
    }
  }

  /**
   * Get exchange rate from database
   */
  private async getExchangeRateFromDB(
    from: string,
    to: string,
  ): Promise<string | null> {
    const rate = await this.prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency: from,
          toCurrency: to,
        },
      },
    });
    return rate?.rate ? rate.rate.toString() : null;
  }

  /**
   * Convert amount from one currency to another using cached rates
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{ convertedAmount: number; rate: number; lastUpdated: Date }> {
    if (fromCurrency === toCurrency) {
      return {
        convertedAmount: amount,
        rate: 1,
        lastUpdated: new Date(),
      };
    }

    const exchangeRate = await this.prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency,
          toCurrency,
        },
      },
    });

    if (!exchangeRate) {
      throw new Error(
        `Exchange rate not found for ${fromCurrency} to ${toCurrency}`,
      );
    }

    const rate = parseFloat(exchangeRate.rate.toString());
    const convertedAmount = amount * rate;

    return {
      convertedAmount,
      rate,
      lastUpdated: exchangeRate.lastUpdated,
    };
  }

  /**
   * Get all cached exchange rates
   */
  async getAllExchangeRates() {
    return this.prisma.exchangeRate.findMany({
      orderBy: { lastUpdated: 'desc' },
    });
  }

  /**
   * Get exchange rate info
   */
  async getExchangeRateInfo(from: string, to: string) {
    return this.prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency: from,
          toCurrency: to,
        },
      },
    });
  }
}
