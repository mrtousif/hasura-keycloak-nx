import { Injectable, Logger } from '@nestjs/common';
import { gql } from 'graphql-request';
import { IncomingMessage } from 'http';
import {
  AuthorizationParameters,
  Client,
  OpenIDCallbackChecks,
  UserinfoResponse,
} from 'openid-client';

import { InjectEnvalid, Config } from '../config/index';
import { GqlSdk, InjectSdk } from '../sdk/sdk.module';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectOIDC } from './oidc';

gql`
  mutation createUser($input: users_insert_input!) {
    insert_users_one(object: $input) {
      id
      email
      name
      phone
      created_at
    }
  }

  mutation updateUserByAuthId($auth_id: uuid!, $input: users_set_input!) {
    update_users(where: { auth_id: { _eq: $auth_id } }, _set: $input) {
      returning {
        id
        email
      }
    }
  }

  query findUserByEmail($email: citext!) {
    users(where: { email: { _eq: $email } }) {
      id
      name
      phone
      created_at
    }
  }

  query findUserById($id: uuid!) {
    users_by_pk(id: $id) {
      id
      name
      email
      phone
      created_at
    }
  }
`;

export interface LoginUserArgs {
  email: string;
  password: string;
}

export interface RegisterUserArgs {
  email: string;
  displayName?: string;
  password: string;
}

export interface LoginOrRegisterUserOutput {
  token?: string;
  error?: string;
}
export interface IUserInfo {
  sub: string;
  email_verified: boolean;
  'https://hasura.io/jwt/claims': HTTPSHasuraIoJwtClaims;
  preferred_username: string;
  email: string;
}

export interface HTTPSHasuraIoJwtClaims {
  'x-hasura-default-role': string;
  'x-hasura-user-id': string;
  'x-hasura-allowed-roles': string[];
}
@Injectable()
export class AuthService {
  openIdClient: Client;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectSdk() private readonly sdk: GqlSdk,
    @InjectOIDC() openIdClient: Client,
    @InjectEnvalid() private readonly env: Config
  ) {
    this.openIdClient = openIdClient;
  }

  async getUserInfo(accessToken: string) {
    return await this.openIdClient.userinfo<IUserInfo>(accessToken);
  }

  async callback(request: IncomingMessage, checks: OpenIDCallbackChecks) {
    const params = this.openIdClient.callbackParams(request);

    return await this.openIdClient.callback(
      this.env.OPENID_CLIENT_REGISTRATION_LOGIN_REDIRECT_URI,
      params,
      checks
    );
  }

  getAuthorizationUrl(params: AuthorizationParameters) {
    return this.openIdClient.authorizationUrl(params);
  }

  refreshToken(refreshToekn: string) {
    return this.openIdClient.refresh(refreshToekn);
  }

  public async createOrUpdateUser(input: CreateUserDto) {
    let name = input.name;
    if (name?.length < 1) {
      name = input.email.split('@')[0];
    }
    try {
      this.logger.debug(
        {
          input,
        },
        'Creating user'
      );
      const { insert_users_one } = await this.sdk.createUser({
        input: {
          auth_id: input.authId,
          email: input.email,
          name,
        },
      });
      this.logger.log({ insert_users_one }, 'User created');
    } catch (error) {
      if (error.message.includes('Uniqueness violation')) {
        this.logger.debug({ authId: input.authId }, 'Updating User');
        const { email } = input;
        this.sdk.updateUserByAuthId({
          auth_id: input.authId,
          input: { email },
        });
      } else {
        this.logger.error(error);
      }
    }

    return;
  }

  public findUser(id: string) {
    return this.sdk.findUserById({ id });
  }
}
