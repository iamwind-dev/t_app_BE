import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ModerateTextDto } from './dto/moderate-text.dto';
import { ModerationResult } from './interfaces/moderation-result.interface';
import { ModerationService } from './moderation.service';

@ApiTags('Moderation')
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('check')
  @ApiOkResponse({ description: 'Check moderation result from AI service.' })
  async check(@Body() dto: ModerateTextDto): Promise<ModerationResult> {
    return this.moderationService.moderateText(dto.text);
  }
}
