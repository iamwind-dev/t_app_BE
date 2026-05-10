import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { UserIdParamDto } from '../users/dto/user-params.dto';
import { FollowsQueryDto } from './dto/follows-query.dto';
import { FollowsService } from './follows.service';
import { FollowActionResponse, FollowListPage } from './types/follow-response.type';

@ApiTags('Follows')
@Controller('users')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':id/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current user followed the selected user.' })
  async followUser(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: UserIdParamDto,
  ): Promise<FollowActionResponse> {
    const user = await this.followsService.followUser(currentUser.id, params.id);
    return { user };
  }

  @Delete(':id/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current user unfollowed the selected user.' })
  async unfollowUser(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: UserIdParamDto,
  ): Promise<FollowActionResponse> {
    const user = await this.followsService.unfollowUser(currentUser.id, params.id);
    return { user };
  }

  @Get(':id/followers')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ description: 'Followers for a user profile.' })
  getFollowers(
    @Param() params: UserIdParamDto,
    @Query() query: FollowsQueryDto,
    @CurrentUser() currentUser?: AuthenticatedRequestUser,
  ): Promise<FollowListPage> {
    return this.followsService.getFollowers(params.id, query, currentUser?.id);
  }

  @Get(':id/following')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ description: 'Following list for a user profile.' })
  getFollowing(
    @Param() params: UserIdParamDto,
    @Query() query: FollowsQueryDto,
    @CurrentUser() currentUser?: AuthenticatedRequestUser,
  ): Promise<FollowListPage> {
    return this.followsService.getFollowing(params.id, query, currentUser?.id);
  }
}
