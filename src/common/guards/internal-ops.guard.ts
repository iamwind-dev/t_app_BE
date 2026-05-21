import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class InternalOpsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, unknown> }>();
    const expectedToken = process.env.INTERNAL_OPS_TOKEN;

    if (!expectedToken || expectedToken.trim().length === 0) {
      throw new ForbiddenException({
        code: 'OPS_ACCESS_DISABLED',
        message: 'Internal ops token is not configured.',
      });
    }

    const tokenHeader = request.headers?.['x-internal-token'];
    const providedToken = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

    if (providedToken !== expectedToken) {
      throw new ForbiddenException({
        code: 'OPS_FORBIDDEN',
        message: 'Internal ops access is forbidden.',
      });
    }

    return true;
  }
}

