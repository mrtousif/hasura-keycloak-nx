import { Inject } from '@nestjs/common';
import { config } from '../config/index';
import { Issuer } from 'openid-client';
import { JwksClient } from 'jwks-rsa';

export interface HasuraJwtClaims<
  CustomClaims extends Record<string, string | string[]> = {}
> {
  'https://hasura.io/jwt/claims': {
    'x-hasura-default-role': string;
    'x-hasura-allowed-roles': string[];
  } & CustomClaims;
}

export type UserJwtClaims = HasuraJwtClaims<{ 'x-hasura-user-id': string }>;

export const buildOpenIdClient = async () => {
  const TrustIssuer = await Issuer.discover(
    `${config.OPENID_CLIENT_PROVIDER_OIDC_ISSUER}/.well-known/openid-configuration`
  );

  return new TrustIssuer.Client({
    client_id: config.OPENID_CLIENT_REGISTRATION_LOGIN_CLIENT_ID,
    client_secret: config.OPENID_CLIENT_REGISTRATION_LOGIN_CLIENT_SECRET,
  });
};

export const OIDC = 'OIDC';
export const InjectOIDC = () => Inject(OIDC);

export const jwksClient = new JwksClient({
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // Defaults to 10m
  jwksUri: config.OPENID_CLIENT_PROVIDER_JWK_URL,
});
