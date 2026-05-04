import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = this.buildErrorResponse(exception);

    response.status(status).json(body);
  }

  private buildErrorResponse(exception: unknown): ErrorResponseBody {
    if (!(exception instanceof HttpException)) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error.',
        },
      };
    }

    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        success: false,
        error: {
          code: this.codeFromStatus(exception.getStatus()),
          message: exceptionResponse,
        },
      };
    }

    const responseObject = exceptionResponse as Record<string, unknown>;
    const message = responseObject.message;

    return {
      success: false,
      error: {
        code:
          typeof responseObject.code === 'string'
            ? responseObject.code
            : this.codeFromStatus(exception.getStatus()),
        message: Array.isArray(message)
          ? message.join(', ')
          : typeof message === 'string'
            ? message
            : exception.message,
        details: Array.isArray(message) ? message : undefined,
      },
    };
  }

  private codeFromStatus(status: number): string {
    const statusCodeMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
      [HttpStatus.UNAUTHORIZED]: 'AUTH_UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'AUTH_FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
    };

    return statusCodeMap[status] ?? 'INTERNAL_SERVER_ERROR';
  }
}
