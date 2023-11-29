import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
// import got from 'got';
import { JwksClient } from 'jwks-rsa';

import { SdkModule } from '../sdk/sdk.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { buildOpenIdClient, OIDC } from './oidc';

const OidcFactory = {
  provide: OIDC,
  useFactory: async () => {
    return await buildOpenIdClient();
  },
};

const client = new JwksClient({
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // Defaults to 10m
  jwksUri: process.env.OPENID_CLIENT_PROVIDER_JWK_URL,
});

@Module({
  imports: [
    SdkModule,
    JwtModule.registerAsync({
      useFactory: async () => {
        const keys = await client.getSigningKeys();

        return {
          publicKey: keys[0].getPublicKey(),
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
