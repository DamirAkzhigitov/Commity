import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { assistantChatRequestSchema } from '@personal-assistant/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { SupabaseJwtAuthGuard } from '../auth/supabase-jwt-auth.guard';
import { AssistantContractException } from './assistant-contract-error';
import { AssistantContractExceptionFilter } from './assistant-contract-exception.filter';
import { AssistantService } from './assistant.service';
import { ChatRequestDto } from './chat-request.dto';

@Controller('assistant')
@UseGuards(SupabaseJwtAuthGuard)
@UseFilters(AssistantContractExceptionFilter)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('chat')
  @HttpCode(200)
  chat(
    @CurrentUser() user: AuthUser,
    @Body() body: ChatRequestDto,
    @Req() req: HttpClientLike,
  ) {
    const parsed = assistantChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AssistantContractException(
        'REQUEST_VALIDATION_FAILED',
        'Invalid chat request.',
        HttpStatus.BAD_REQUEST,
        { issues: parsed.error.flatten() },
      );
    }
    return this.assistantService.chat({
      userId: user.sub,
      request: parsed.data,
      signal: buildAbortSignal(req),
    });
  }
}

/**
 * Minimal duck-typed shape for the inbound request. Avoids a hard dep on
 * `@types/express` so the build does not require additional types.
 */
interface HttpClientLike {
  signal?: AbortSignal;
  on?: (event: string, listener: () => void) => void;
}

/**
 * Build an AbortSignal that fires when the inbound HTTP client disconnects,
 * so the upstream OpenAI call is cancelled and we stop billing tokens for
 * a request that no one is waiting for.
 */
function buildAbortSignal(req: HttpClientLike): AbortSignal | undefined {
  if (req?.signal) {
    return req.signal;
  }
  if (typeof req?.on !== 'function') return undefined;

  const controller = new AbortController();
  const onClose = () => controller.abort();
  req.on('close', onClose);
  req.on('aborted', onClose);
  return controller.signal;
}
