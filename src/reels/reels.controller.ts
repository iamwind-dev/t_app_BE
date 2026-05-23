import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { CreateReelCommentDto } from './dto/create-reel-comment.dto';
import { CreateReelDto } from './dto/create-reel.dto';
import { ReelCommentQueryDto } from './dto/reel-comment-query.dto';
import { ReelFeedQueryDto } from './dto/reel-feed-query.dto';
import { ReelIdParamDto } from './dto/reel-param.dto';
import { ReelsService } from './reels.service';
import {
  DeleteReelResponse,
  ReelCommentListResponse,
  ReelCommentResponse,
  ReelFeedResponse,
  ReelReactionResponse,
  ReelResponse,
} from './types/reel-response.type';

@ApiTags('Reels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reels')
export class ReelsController {
  constructor(private readonly reelsService: ReelsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Reel created successfully.' })
  create(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Body() dto: CreateReelDto,
  ): Promise<ReelResponse> {
    return this.reelsService.createReel(currentUser.id, dto);
  }

  @Get('feed')
  @ApiOkResponse({ description: 'Latest reel feed.' })
  getFeed(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Query() query: ReelFeedQueryDto,
  ): Promise<ReelFeedResponse> {
    return this.reelsService.getFeed(currentUser.id, query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Reel detail.' })
  getById(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ReelIdParamDto,
  ): Promise<ReelResponse> {
    return this.reelsService.getReelById(currentUser.id, params.id);
  }

  @Post(':id/like')
  @ApiOkResponse({ description: 'Reel liked successfully.' })
  like(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ReelIdParamDto,
  ): Promise<ReelReactionResponse> {
    return this.reelsService.likeReel(currentUser.id, params.id);
  }

  @Delete(':id/like')
  @ApiOkResponse({ description: 'Reel unliked successfully.' })
  unlike(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ReelIdParamDto,
  ): Promise<ReelReactionResponse> {
    return this.reelsService.unlikeReel(currentUser.id, params.id);
  }

  @Get(':id/comments')
  @ApiOkResponse({ description: 'Comments for a reel.' })
  listComments(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ReelIdParamDto,
    @Query() query: ReelCommentQueryDto,
  ): Promise<ReelCommentListResponse> {
    return this.reelsService.listComments(currentUser.id, params.id, query);
  }

  @Post(':id/comments')
  @ApiCreatedResponse({ description: 'Comment created for reel.' })
  createComment(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ReelIdParamDto,
    @Body() dto: CreateReelCommentDto,
  ): Promise<ReelCommentResponse> {
    return this.reelsService.createComment(currentUser.id, params.id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Reel soft deleted successfully.' })
  delete(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ReelIdParamDto,
  ): Promise<DeleteReelResponse> {
    return this.reelsService.deleteReel(currentUser.id, params.id);
  }
}
