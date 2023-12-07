import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { Client } from 'openid-client';
import { ENVALID } from 'nestjs-envalid';

describe('AuthService', () => {
  let service: AuthService;
  let openidClient: Client;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: 'OIDC',
          useValue: {
            userinfo: jest.fn(),
            callbackParams: jest.fn(),
            callback: jest.fn(),
            authorizationUrl: jest.fn(),
            refresh: jest.fn(),
          },
        },
        {
          provide: 'SDK',
          useValue: {
            createUser: jest.fn(),
            updateUserByAuthId: jest.fn(),
            findUserById: jest.fn(),
          },
        },
        {
          provide: ENVALID,
          useValue: {
            OPENID_CLIENT_REGISTRATION_LOGIN_REDIRECT_URI:
              'http://loccalhost:8000/',
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    openidClient = module.get<Client>('OIDC');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get user info', async () => {
    const userInfo = {
      sub: '338a79f4-2535-4bda-b1b2-6d9ecb6a6851',
      email_verified: false,
      'https://hasura.io/jwt/claims': {
        'x-hasura-default-role': 'user',
        'x-hasura-user-id': '338a79f4-2535-4bda-b1b2-6d9ecb6a6851',
        'x-hasura-allowed-roles': ['user'],
      },
      preferred_username: 'john_user',
      email: 'user@emaii.com',
    };
    jest.spyOn(openidClient, 'userinfo').mockResolvedValue(userInfo);
    const result = await service.getUserInfo('abcd');

    expect(result).toEqual(userInfo);
  });
});
