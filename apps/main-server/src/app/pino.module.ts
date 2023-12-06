import { Module, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ENVALID, EnvalidModule } from 'nestjs-envalid';
import { Config } from './config';
import { randomUUID } from 'crypto';

// Fields to redact from logs
const redactFields = [
  'req.headers.authorization',
  'req.body.password',
  'req.body.confirmPassword',
];
const basePinoOptions = {
  translateTime: true,
  ignore: 'pid,hostname',
  //   singleLine: true,
  //   redact: redactFields,
};

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [EnvalidModule],
      inject: [ENVALID],
      useFactory: (env: Config) => ({
        pinoHttp: {
          timestamp: () =>
            `,"timestamp":"${new Date(Date.now()).toISOString()}"`,
          name: 'nx-nest-hasura',
          customProps: (_request, _response) => ({
            context: 'HTTP',
          }),
          genReqId: function (req, res) {
            const existingID = req.id ?? req.headers['x-request-id'];
            if (existingID) return existingID;
            const id = randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
          },
          serializers: {
            req(request: {
              body: Record<string, any>;
              raw: {
                body: Record<string, any>;
              };
            }) {
              request.body = request.raw.body;

              return request;
            },
          },
          redact: {
            paths: redactFields,
            censor: '**GDPR COMPLIANT**',
          },
          level: env.NODE_ENV !== 'production' ? 'debug' : 'info',
          transport:
            env.NODE_ENV !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: {
                    ...basePinoOptions,
                  },
                }
              : undefined,
        },
        exclude: [{ method: RequestMethod.ALL, path: 'doc' }],
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class NestPinoModule {}
