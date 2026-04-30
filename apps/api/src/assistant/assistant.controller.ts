import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { assistantChatRequestSchema } from '@personal-assistant/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { SupabaseJwtAuthGuard } from '../auth/supabase-jwt-auth.guard';
import { AssistantService } from './assistant.service';
import { ChatRequestDto } from './chat-request.dto';

@Controller('assistant')
@UseGuards(SupabaseJwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('chat')
  @HttpCode(200)
  chat(@CurrentUser() user: AuthUser, @Body() body: ChatRequestDto) {
    const parsed = assistantChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid chat request',
        issues: parsed.error.flatten(),
      });
    }
    return this.assistantService.chat({
      userId: user.sub,
      request: parsed.data,
    });
  }
}
