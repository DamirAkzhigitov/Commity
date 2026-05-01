import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AssistantContractException,
  type AssistantContractErrorBody,
  type AssistantContractErrorCode,
} from './assistant-contract-error';

/**
 * Minimal duck-typed shape for the response object so we don't take a hard
 * dep on `@types/express` here.
 */
interface JsonResponseLike {
  status: (code: number) => JsonResponseLike;
  json: (body: unknown) => unknown;
}

/**
 * Projects assistant errors to the contract shape documented in
 * `docs/ai-context-contract.md`:
 *
 *   { "error": { "code": "...", "message": "...", "details": { ... } } }
 *
 * - `AssistantContractException` is passed through unchanged.
 * - `UnauthorizedException` and `ForbiddenException` are mapped to the
 *   matching contract codes (`AUTH_REQUIRED`, `ENTITLEMENT_INACTIVE` /
 *   `ASSISTANT_QUOTA_EXCEEDED`).
 * - Any other `HttpException` is mapped on a best-effort basis based on
 *   status (400 → `REQUEST_VALIDATION_FAILED`, otherwise `INTERNAL_ERROR`).
 * - Anything else falls back to `INTERNAL_ERROR` with a 500 status.
 */
@Catch()
export class AssistantContractExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AssistantContractExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<JsonResponseLike>();

    const { status, body } = this.toContractResponse(exception);
    res.status(status).json(body);
  }

  private toContractResponse(exception: unknown): {
    status: number;
    body: AssistantContractErrorBody;
  } {
    if (exception instanceof AssistantContractException) {
      return {
        status: exception.getStatus(),
        body: exception.getResponse() as AssistantContractErrorBody,
      };
    }

    if (exception instanceof UnauthorizedException) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        body: this.buildBody('AUTH_REQUIRED', exception.message),
      };
    }

    if (exception instanceof ForbiddenException) {
      const message = exception.message || 'Forbidden';
      const code: AssistantContractErrorCode = /quota/i.test(message)
        ? 'ASSISTANT_QUOTA_EXCEEDED'
        : 'ENTITLEMENT_INACTIVE';
      return {
        status: HttpStatus.FORBIDDEN,
        body: this.buildBody(code, message),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const original = exception.getResponse();
      const message = this.extractMessage(original) ?? exception.message;
      const code: AssistantContractErrorCode =
        status === HttpStatus.BAD_REQUEST
          ? 'REQUEST_VALIDATION_FAILED'
          : status === HttpStatus.PAYLOAD_TOO_LARGE
            ? 'CONTEXT_PACKET_TOO_LARGE'
            : 'INTERNAL_ERROR';
      return { status, body: this.buildBody(code, message) };
    }

    const e = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`Unhandled assistant error: ${e.message}`, e.stack);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: this.buildBody('INTERNAL_ERROR', 'Internal server error.'),
    };
  }

  private extractMessage(payload: unknown): string | undefined {
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const m = (payload as { message: unknown }).message;
      if (typeof m === 'string') return m;
      if (Array.isArray(m)) return m.join('; ');
    }
    return undefined;
  }

  private buildBody(
    code: AssistantContractErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ): AssistantContractErrorBody {
    return {
      error: { code, message, ...(details ? { details } : {}) },
    };
  }
}
