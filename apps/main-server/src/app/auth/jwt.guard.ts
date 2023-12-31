import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { IncomingMessage } from 'http';
import { TokenSet, generators } from 'openid-client';

import { InjectEnvalid, Config } from '../config/index';
import { AuthService, IUserInfo } from './auth.service';
import { jwksClient } from './oidc';

export type FastifyRequestType = FastifyRequest & {
  user?: UserJWT | IUserInfo;
  accessToken?: string;
  refreshToken?: string;
};

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger(JwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    @InjectEnvalid() private readonly env: Config
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest<FastifyRequestType>(context);
    const response: FastifyReply = context.switchToHttp().getResponse();
    const sessionKey = 'oidc';
    try {
      let token = this.getToken(request);
      const key = await jwksClient.getSigningKey();
      const user = await this.jwtService.verifyAsync<UserJWT>(token, {
        secret: key.getPublicKey(),
      });
      this.logger.debug({ user: { exp: user.exp } }, `USER:${user.sub}`);
      const refreshToken = request.cookies['refresh_token'];
      const { active } = await this.authService.introspect(refreshToken);

      if (active != true) {
        this.redirectToLogin(request, response, sessionKey);
      } else if (refreshToken?.length > 1 && Date.now() >= user.exp * 1000) {
        try {
          const result = await this.authService.refreshToken(refreshToken);
          response.setCookie('access_token', `Bearer ${result.access_token}`);
          response.setCookie('refresh_token', result.refresh_token);
          response.setCookie('id_token', result.id_token);
          token = result.access_token;
        } catch (error) {
          this.redirectToLogin(request, response, sessionKey);
        }
      }

      request.user = user;
      request.accessToken = token;
      request.refreshToken = refreshToken;
      return true;
    } catch (e) {
      const session = request.session.get(sessionKey);

      if (session?.state && session?.nonce) {
        const { state, nonce } = session;
        const req = request as unknown as IncomingMessage;
        try {
          delete request.session[sessionKey];
        } catch (err) {}
        let result: TokenSet;
        try {
          result = await this.authService.callback(req, {
            state,
            nonce,
          });
          this.logger.debug({ result }, 'auth service callback result');

          response.headers['authorization'] = `Bearer ${result.access_token}`;
          response.setCookie('access_token', `Bearer ${result.access_token}`);
          response.setCookie('refresh_token', result.refresh_token);
          response.setCookie('id_token', result.id_token);
          const user = await this.authService.getUserInfo(result.access_token);
          request.user = user;
          await this.authService.createOrUpdateUser({
            authId: user.sub,
            name: user.given_name || user.preferred_username,
            email: user.email,
          });

          return true;
        } catch (error) {
          this.redirectToLogin(request, response, sessionKey);
        }
      } else {
        this.redirectToLogin(request, response, sessionKey);
      }

      return false;
    }
  }

  private redirectToLogin(
    request: FastifyRequest,
    response: FastifyReply,
    sessionKey: string
  ) {
    if (!response.redirect) {
      throw new UnauthorizedException();
    }
    try {
      delete request.session[sessionKey];
    } catch (err) {}
    const params = {
      state: generators.state(),
      nonce: generators.nonce(),
    };
    request.session.set(sessionKey, params);
    const authUrl = this.authService.getAuthorizationUrl({
      ...params,
      redirect_uri: this.env.OPENID_CLIENT_REGISTRATION_LOGIN_REDIRECT_URI,
      scope: 'openid email profile',
    });

    this.logger.debug(`Redirecting to auth url ${authUrl}`);

    response.redirect(authUrl);
  }

  protected getRequest<T>(context: ExecutionContext): T {
    return context.switchToHttp().getRequest();
  }

  protected getToken(request: FastifyRequest): string {
    const authorization =
      request.headers['authorization'] || request.cookies['access_token'];
    if (!authorization || Array.isArray(authorization)) {
      throw new UnauthorizedException('Invalid Authorization Header');
    }
    const [_, token] = authorization.split(' ');
    return token;
  }
}

@Injectable()
export class GqlJwtAuthGuard extends JwtGuard {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}

export interface UserJWT {
  exp: number;
  iat: number;
  auth_time: number;
  jti: string;
  iss: string;
  aud: string;
  sub: string;
  typ: string;
  azp: string;
  nonce: string;
  session_state: string;
  acr: string;
  realm_access: RealmAccess;
  resource_access: ResourceAccess;
  scope: string;
  sid: string;
  email_verified: boolean;
  'https://hasura.io/jwt/claims': HTTPSHasuraIoJwtClaims;
  preferred_username: string;
  given_name: string;
  family_name: string;
  email: string;
}

export interface HTTPSHasuraIoJwtClaims {
  'x-hasura-default-role': string;
  'x-hasura-user-id': string;
  'x-hasura-allowed-roles': string[];
}

export interface RealmAccess {
  roles: string[];
}

export interface ResourceAccess {
  account: Account;
  hasura: Account;
}

export interface Account {
  roles: null[];
}
