import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { PostIdParamDto } from './dto/post-param.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';
import { DeletePostResponse, FeedResponse, PostResponse } from './types/post-response.type';

@ApiTags('Posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Post created successfully.' })
  create(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Body() dto: CreatePostDto,
  ): Promise<PostResponse> {
    return this.postsService.createPost(currentUser.id, dto);
  }

  @Get('feed')
  @ApiOkResponse({ description: 'Latest post feed.' })
  getFeed(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Query() query: FeedQueryDto,
  ): Promise<FeedResponse> {
    return this.postsService.getFeed(currentUser.id, query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Post detail.' })
  getById(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: PostIdParamDto,
  ): Promise<PostResponse> {
    return this.postsService.getPostById(currentUser.id, params.id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Post updated successfully.' })
  update(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: PostIdParamDto,
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponse> {
    return this.postsService.updatePost(currentUser.id, params.id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Post soft deleted successfully.' })
  delete(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: PostIdParamDto,
  ): Promise<DeletePostResponse> {
    return this.postsService.deletePost(currentUser.id, params.id);
  }
}
