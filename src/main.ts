import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

// Bug connu de @prisma/adapter-pg (Prisma 7.x) : performIO() passe `values` deux
// fois à pg's client.query(), ce qui déclenche le chemin déprécié du driver pg
// et affiche ce warning sur quasi toute requête Prisma. C'est cosmétique — la
// requête s'exécute normalement — et suivi ici : github.com/prisma/prisma/issues/29646
// et github.com/prisma/prisma/issues/29407. À retirer une fois le correctif publié
// (npm install @prisma/adapter-pg@latest prisma@latest pour vérifier).
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('client.query()')) {
    return;
  }
  console.warn(warning);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();