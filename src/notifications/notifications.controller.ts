import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { NotificationIdParamDto } from './dto/notification-params.dto';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { TestPushTokenDto } from './dto/test-push-token.dto';
import { TestPushUserDto } from './dto/test-push-user.dto';
import { NotificationsService } from './notifications.service';
import {
  MarkAllNotificationsReadResponse,
  NotificationListResponse,
  NotificationResponse,
  UnreadNotificationsCountResponse,
} from './types/notification-response.type';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test')
  @ApiOkResponse({ description: 'Send a test push notification to one token.' })
  sendTestPushToToken(@Body() dto: TestPushTokenDto): Promise<{ sent: true }> {
    return this.notificationsService.sendTestPushToToken(dto);
  }

  @Post('test/user/:userId')
  @ApiOkResponse({ description: 'Send a test push notification to all tokens of a user.' })
  sendTestPushToUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: TestPushUserDto,
  ): Promise<{
    requestedCount: number;
    successCount: number;
    failureCount: number;
    invalidTokens: string[];
  }> {
    return this.notificationsService.sendTestPushToUser(userId, dto);
  }

  @Get('unread-count')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Unread notification count.' })
  getUnreadCount(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
  ): Promise<UnreadNotificationsCountResponse> {
    return this.notificationsService.getUnreadCount(currentUser.id);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Current user notifications.' })
  listNotifications(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Query() query: NotificationsQueryDto,
  ): Promise<NotificationListResponse> {
    return this.notificationsService.listNotifications(currentUser.id, query);
  }

  @Patch(':id/read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Notification marked as read.' })
  markAsRead(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: NotificationIdParamDto,
  ): Promise<NotificationResponse> {
    return this.notificationsService.markAsRead(currentUser.id, params.id);
  }

  @Patch('read-all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'All unread notifications marked as read.' })
  markAllAsRead(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
  ): Promise<MarkAllNotificationsReadResponse> {
    return this.notificationsService.markAllAsRead(currentUser.id);
  }
}
