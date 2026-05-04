import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { NotificationIdParamDto } from './dto/notification-params.dto';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { NotificationsService } from './notifications.service';
import {
  MarkAllNotificationsReadResponse,
  NotificationListResponse,
  NotificationResponse,
} from './types/notification-response.type';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOkResponse({ description: 'Current user notifications.' })
  listNotifications(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Query() query: NotificationsQueryDto,
  ): Promise<NotificationListResponse> {
    return this.notificationsService.listNotifications(currentUser.id, query);
  }

  @Patch(':id/read')
  @ApiOkResponse({ description: 'Notification marked as read.' })
  markAsRead(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: NotificationIdParamDto,
  ): Promise<NotificationResponse> {
    return this.notificationsService.markAsRead(currentUser.id, params.id);
  }

  @Patch('read-all')
  @ApiOkResponse({ description: 'All unread notifications marked as read.' })
  markAllAsRead(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
  ): Promise<MarkAllNotificationsReadResponse> {
    return this.notificationsService.markAllAsRead(currentUser.id);
  }
}
