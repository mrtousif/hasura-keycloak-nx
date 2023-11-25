import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import fastifyCookie from '@fastify/cookie';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import secureSession from '@fastify/secure-session';
import { AppModule } from './app/app.module';
import { config } from './app/config';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
    }),
    { bufferLogs: true }
  );

  await app.register(fastifyCookie, {
    secret: config.COOKIE_SECRET, // for cookies signature
  });

  await app.register(secureSession, {
    secret: config.SESSION_SECRET,
    salt: 'mq9hDxBVDbspDR6n',
  });

  const logger = app.get(Logger);
  app.useLogger(logger);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = config.PORT;
  await app.listen(port);
  logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
