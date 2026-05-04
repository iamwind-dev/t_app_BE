import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserIdParamDto, UsernameParamDto } from './dto/user-params.dto';
import { UserPostsQueryDto } from './dto/user-posts-query.dto';
import { PublicUserProfile, UserPostsPage } from './types/user-profile.type';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('username/:username')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ description: 'Public profile by username.' })
  async getByUsername(
    @Param() params: UsernameParamDto,
    @CurrentUser() currentUser?: AuthenticatedRequestUser,
  ): Promise<{ user: PublicUserProfile }> {
    const user = await this.usersService.getProfileByUsername(params.username, currentUser?.id);
    return { user };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current user profile updated.' })
  async updateMe(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<{ user: PublicUserProfile }> {
    const user = await this.usersService.updateMe(currentUser.id, dto);
    return { user };
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current user followed the selected user.' })
  async followUser(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: UserIdParamDto,
  ): Promise<{ user: PublicUserProfile }> {
    const user = await this.usersService.followUser(currentUser.id, params.id);
    return { user };
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current user unfollowed the selected user.' })
  async unfollowUser(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: UserIdParamDto,
  ): Promise<{ user: PublicUserProfile }> {
    const user = await this.usersService.unfollowUser(currentUser.id, params.id);
    return { user };
  }

  @Get(':id/posts')
  @ApiOkResponse({ description: 'Posts for a user profile.' })
  async getUserPosts(
    @Param() params: UserIdParamDto,
    @Query() query: UserPostsQueryDto,
  ): Promise<UserPostsPage> {
    return this.usersService.getUserPosts(params.id, query);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ description: 'Public profile by user id.' })
  async getById(
    @Param() params: UserIdParamDto,
    @CurrentUser() currentUser?: AuthenticatedRequestUser,
  ): Promise<{ user: PublicUserProfile }> {
    const user = await this.usersService.getProfileById(params.id, currentUser?.id);
    return { user };
  }
}
