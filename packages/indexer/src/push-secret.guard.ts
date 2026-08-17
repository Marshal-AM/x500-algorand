import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class PushSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.INDEXER_PUSH_SECRET?.trim();
    if (!expected) {
      throw new UnauthorizedException("INDEXER_PUSH_SECRET is not configured");
    }
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const got =
      req.headers["x-indexer-push-secret"] ??
      req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
    if (got !== expected) {
      throw new UnauthorizedException("invalid push secret");
    }
    return true;
  }
}
