import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  AuthResponse,
  ChangePasswordResponse,
  LogoutResponse,
  PublicAuthUser,
  TokenRefreshResponse,
} from './types/auth-user.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ description: 'Account registered successfully.' })
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'User logged in successfully.' })
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Access token refreshed successfully.' })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenRefreshResponse> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Refresh token revoked successfully.' })
  logout(@Body() dto: LogoutDto): Promise<LogoutResponse> {
    return this.authService.logout(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Password changed successfully.' })
  changePassword(
    @CurrentUser() user: AuthenticatedRequestUser | undefined,
    @Body() dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponse> {
    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Authentication is required.',
      });
    }

    return this.authService.changePassword(user.id, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current authenticated user.' })
  me(@CurrentUser() user: AuthenticatedRequestUser | undefined): Promise<{ user: PublicAuthUser }> {
    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Authentication is required.',
      });
    }

    return this.authService.getCurrentUser(user.id).then((currentUser) => ({ user: currentUser }));
  }
}
