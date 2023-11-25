import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { gql } from 'graphql-request';
import { IncomingMessage } from 'http';
import {
  AuthorizationParameters,
  Client,
  OpenIDCallbackChecks,
  UserinfoResponse,
} from 'openid-client';

import { InjectEnvalid, Config, config } from '../config/index';
import { GqlSdk, InjectSdk } from '../sdk/sdk.module';
import { CreateUserDto } from './dto/create-user.dto';

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

  mutation updateUserById($id: uuid!, $input: users_set_input!) {
    update_users_by_pk(pk_columns: { id: $id }, _set: $input) {
      email
      id
      name
      phone
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

@Injectable()
export class AuthService {
  openIdClient: Client;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectSdk() private readonly sdk: GqlSdk,
    @Inject('OIDC') openIdClient: Client,
    @InjectEnvalid() private readonly env: Config
  ) {
    this.openIdClient = openIdClient;
  }

  async getUserInfo(accessToken: string): Promise<UserinfoResponse> {
    return await this.openIdClient.userinfo(accessToken);
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
          id: input.id,
          email: input.email,
        },
        'Creating user'
      );
      const { insert_users_one } = await this.sdk.createUser({
        input: {
          id: input.id,
          email: input.email,
          name,
        },
      });
      this.logger.log('User created', insert_users_one);
    } catch (error) {
      if (error.message.includes('Uniqueness violation')) {
        this.logger.debug({ id: input.id }, 'Updating User');
        this.sdk.updateUserById({
          id: input.id,
          input: { ...input, name },
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
