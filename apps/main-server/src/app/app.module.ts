import { HasuraModule } from '@golevelup/nestjs-hasura';
import { Module } from '@nestjs/common';
import { join } from 'path';
import { GraphQLModule } from '@nestjs/graphql';
import { LoggerModule } from 'nestjs-pino';
import { MercuriusDriver, MercuriusDriverConfig } from '@nestjs/mercurius';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { SdkModule } from './sdk/sdk.module';
import { ENVALID, EnvalidModule } from 'nestjs-envalid';
import { Config, validators } from './config';

@Module({
  imports: [
    AuthModule,
    SdkModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
      },
    }),
    EnvalidModule.forRoot({ validators, isGlobal: true }),
    GraphQLModule.forRoot<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      autoSchemaFile: 'schema.gql',
      subscription: true,
      graphiql: true,
      ide: true,
    }),
    HasuraModule.forRootAsync(HasuraModule, {
      inject: [ENVALID],
      useFactory: (env: Config) => {
        return {
          webhookConfig: {
            secretFactory: env.NESTJS_EVENT_WEBHOOK_SHARED_SECRET,
            secretHeader: 'nestjs-event-webhook',
          },
          managedMetaDataConfig: env.isDev
            ? {
                metadataVersion: 'v3',
                dirPath: join(process.cwd(), 'apps/hasura/metadata'),
                nestEndpointEnvName: 'NESTJS_EVENT_WEBHOOK_ENDPOINT',
                secretHeaderEnvName: 'NESTJS_EVENT_WEBHOOK_SHARED_SECRET',
                defaultEventRetryConfig: {
                  numRetries: 3,
                  timeoutInSeconds: 100,
                  intervalInSeconds: 30,
                  toleranceSeconds: 21600,
                },
              }
            : undefined,
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
