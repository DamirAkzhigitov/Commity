import { Body, Controller, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('chat')
  chat(
    @Body()
    body: {
      userId?: string;
      message: string;
    },
  ) {
    return this.assistantService.chat({
      userId: body.userId ?? 'demo-user',
      message: body.message,
    });
  }
}
