import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { RegisterDeviceTokenDto, RevokeDeviceTokenDto } from './dto/device-token.dto';
import {
  DeviceTokenListResponse,
  DeviceTokenResponse,
  RevokeDeviceTokenResponse,
} from './types/device-token-response.type';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('fcm-token')
  @ApiOkResponse({ description: 'FCM token registered or updated.' })
  registerFcmToken(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Body() dto: RegisterDeviceTokenDto,
  ): Promise<DeviceTokenResponse> {
    return this.devicesService.registerFcmToken(currentUser.id, dto);
  }

  @Delete('fcm-token')
  @ApiOkResponse({ description: 'FCM token revoked.' })
  revokeFcmToken(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Body() dto: RevokeDeviceTokenDto,
  ): Promise<RevokeDeviceTokenResponse> {
    return this.devicesService.revokeFcmToken(currentUser.id, dto);
  }

  @Get('fcm-tokens')
  @ApiOkResponse({ description: 'Current user active FCM tokens.' })
  listFcmTokens(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
  ): Promise<DeviceTokenListResponse> {
    return this.devicesService.listFcmTokens(currentUser.id);
  }
}

