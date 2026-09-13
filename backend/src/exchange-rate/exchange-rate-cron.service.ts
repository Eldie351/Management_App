import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';

@Injectable()
export class ExchangeRateCronService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ExchangeRateCronService.name);
  private cronInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private exchangeRateService: ExchangeRateService) {}

  // OnApplicationBootstrap (plutôt que OnModuleInit) : cette phase ne démarre
  // qu'une fois que TOUS les onModuleInit de l'appli sont terminés, y compris
  // PrismaService.$connect(). Ça évite qu'une requête Prisma parte pendant que
  // la connexion pg est encore en train de s'établir (source du warning
  // "client.query() when the client is already executing a query").
  async onApplicationBootstrap() {
    this.logger.log('🚀 Initializing Exchange Rate Cron Service...');

    // BUGFIX : `onApplicationBootstrap` est attendu par Nest avant de
    // considérer l'application comme démarrée (elle ne se met à écouter
    // qu'une fois tous ces hooks résolus). Un `await` ici faisait donc
    // dépendre la disponibilité de TOUTE l'API d'un appel réseau externe et
    // d'une écriture en base — potentiellement lents (API indisponible,
    // instance Neon en réveil après inactivité...). On lance la récupération
    // en tâche de fond sans bloquer le démarrage : le fallback déjà géré
    // dans ExchangeRateService garantit que l'app reste utilisable même sans
    // taux de change fraîchement mis en cache.
    void this.exchangeRateService.fetchAndCacheExchangeRates().catch((error) => {
      this.logger.error(`Failed to fetch exchange rates on startup: ${String(error)}`);
    });

    // Schedule automatic updates every 6 hours
    this.scheduleCronJob();
  }

  private scheduleCronJob() {
    // 6 hours in milliseconds
    const SIX_HOURS = 6 * 60 * 60 * 1000;

    this.cronInterval = setInterval(async () => {
      if (this.isRunning) {
        this.logger.warn('Previous exchange rate update is still running; skipping this run.');
        return;
      }
      this.isRunning = true;
      try {
        this.logger.log('⏱️ Running scheduled exchange rate update...');
        await this.exchangeRateService.fetchAndCacheExchangeRates();
      } catch (error) {
        this.logger.error(`Scheduled exchange rate update failed: ${String(error)}`);
      } finally {
        this.isRunning = false;
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
