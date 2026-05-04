import { Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { PostReactionParamDto, ReplyReactionParamDto } from './dto/reaction-params.dto';
import { ReactionsService } from './reactions.service';
import { PostReactionResponse, ReplyReactionResponse } from './types/reaction-response.type';

@ApiTags('Reactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post('posts/:postId/like')
  @ApiOkResponse({ description: 'Post liked successfully.' })
  likePost(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: PostReactionParamDto,
  ): Promise<PostReactionResponse> {
    return this.reactionsService.likePost(currentUser.id, params.postId);
  }

  @Delete('posts/:postId/like')
  @ApiOkResponse({ description: 'Post unliked successfully.' })
  unlikePost(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: PostReactionParamDto,
  ): Promise<PostReactionResponse> {
    return this.reactionsService.unlikePost(currentUser.id, params.postId);
  }

  @Post('replies/:replyId/like')
  @ApiOkResponse({ description: 'Reply liked successfully.' })
  likeReply(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ReplyReactionParamDto,
  ): Promise<ReplyReactionResponse> {
    return this.reactionsService.likeReply(currentUser.id, params.replyId);
  }

  @Delete('replies/:replyId/like')
  @ApiOkResponse({ description: 'Reply unliked successfully.' })
  unlikeReply(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ReplyReactionParamDto,
  ): Promise<ReplyReactionResponse> {
    return this.reactionsService.unlikeReply(currentUser.id, params.replyId);
  }
}
