import { config } from '../config/index';
import { Issuer } from 'openid-client';

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
