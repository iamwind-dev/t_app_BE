import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedRequestUser {
  id: string;
  email?: string;
  username?: string;
}

interface RequestWithUser {
  user?: AuthenticatedRequestUser;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedRequestUser | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
