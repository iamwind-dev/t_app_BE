import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { CreateReplyDto } from './dto/create-reply.dto';
import { PostReplyParamDto, ReplyIdParamDto } from './dto/reply-param.dto';
import { ReplyQueryDto } from './dto/reply-query.dto';
import { RepliesService } from './replies.service';
import { ReplyListResponse, ReplyResponse } from './types/reply-response.type';

@ApiTags('Replies')
@Controller()
export class RepliesController {
  constructor(private readonly repliesService: RepliesService) {}

  @Post('posts/:postId/replies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Reply created for post.' })
  createPostReply(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: PostReplyParamDto,
    @Body() dto: CreateReplyDto,
  ): Promise<ReplyResponse> {
    return this.repliesService.createPostReply(currentUser.id, params.postId, dto);
  }

  @Post('replies/:replyId/replies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Child reply created.' })
  createChildReply(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ReplyIdParamDto,
    @Body() dto: CreateReplyDto,
  ): Promise<ReplyResponse> {
    return this.repliesService.createChildReply(currentUser.id, params.replyId, dto);
  }

  @Get('posts/:postId/replies')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ description: 'Replies for a post.' })
  listPostReplies(
    @Param() params: PostReplyParamDto,
    @Query() query: ReplyQueryDto,
    @CurrentUser() currentUser?: AuthenticatedRequestUser,
  ): Promise<ReplyListResponse> {
    return this.repliesService.listPostReplies(currentUser?.id, params.postId, query);
  }

  @Get('replies/:replyId/children')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ description: 'Child replies for a reply.' })
  listChildReplies(
    @Param() params: ReplyIdParamDto,
    @Query() query: ReplyQueryDto,
    @CurrentUser() currentUser?: AuthenticatedRequestUser,
  ): Promise<ReplyListResponse> {
    return this.repliesService.listChildReplies(currentUser?.id, params.replyId, query);
  }
}
