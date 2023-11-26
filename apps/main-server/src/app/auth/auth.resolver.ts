import { Logger, UseGuards } from '@nestjs/common';
import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from './current-user.decorator';
import { GqlJwtAuthGuard } from './jwt.guard';
import { AuthService } from './auth.service';
import { UserinfoResponse } from 'openid-client';

@ObjectType()
class UserProfile {
  @Field({ nullable: false })
  sub: string;
  @Field({ nullable: false })
  email_verified: boolean;
  @Field({ nullable: false })
  email: string;
  @Field({ nullable: false })
  preferred_username: string;
  @Field({ nullable: true })
  error?: string;
}

@Resolver()
export class AuthResolver {
  private readonly logger = new Logger(AuthResolver.name);
  constructor(private readonly authService: AuthService) {}

  @Query((_) => String)
  health() {
    return 'healthy';
  }

  @UseGuards(GqlJwtAuthGuard)
  @Query((_) => UserProfile)
  async userProfile(
    @CurrentUser() user: UserinfoResponse
  ): Promise<UserProfile> {
    this.logger.debug({ user }, 'CurrentUser');
    const { email, email_verified, sub, preferred_username } = user;

    return {
      email,
      email_verified,
      sub,
      preferred_username,
    };
  }
}
