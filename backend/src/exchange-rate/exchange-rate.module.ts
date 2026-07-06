import { Module } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';
import { ExchangeRateController } from './exchange-rate.controller';
import { ExchangeRateCronService } from './exchange-rate-cron.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExchangeRateController],
  providers: [ExchangeRateService, ExchangeRateCronService],
  exports: [ExchangeRateService],
})
export class ExchangeRateModule {}
