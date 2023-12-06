import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { SdkModule } from '../sdk/sdk.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { buildOpenIdClient, OIDC, jwksClient } from './oidc';

const OidcFactory = {
  provide: OIDC,
  useFactory: async () => {
    return await buildOpenIdClient();
  },
};

@Module({
  imports: [
    SdkModule,
    JwtModule.registerAsync({
      useFactory: async () => {
        const key = await jwksClient.getSigningKey();

        return {
          publicKey: key.getPublicKey(),
          verifyOptions: {
            algorithms: ['RS256'],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [OidcFactory, AuthService, AuthResolver],
  exports: [JwtModule],
})
export class AuthModule {}
