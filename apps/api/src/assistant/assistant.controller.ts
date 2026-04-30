import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
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
    return this.assistantService.chat({
      userId: user.sub,
      message: body.message,
    });
  }
}
