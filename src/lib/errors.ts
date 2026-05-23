/**
 * Typed error classes used across the app. Every error a route, action, or
 * service throws should extend AppError so the safe-* wrappers can map it to
 * a public response without leaking internals.
 */

export interface AppErrorOptions {
  code: string;
  statusCode: number;
  publicMessage: string;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly publicMessage: string;

  constructor(opts: AppErrorOptions) {
    super(opts.publicMessage);
    this.name = new.target.name;
    this.code = opts.code;
    this.statusCode = opts.statusCode;
    this.publicMessage = opts.publicMessage;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class ValidationError extends AppError {
  readonly fields: Record<string, string>;

  constructor(message = 'Invalid input', fields: Record<string, string> = {}, cause?: unknown) {
    super({ code: 'VALIDATION_ERROR', statusCode: 400, publicMessage: message, cause });
    this.fields = fields;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'You must be signed in to do that.', cause?: unknown) {
    super({ code: 'UNAUTHORIZED', statusCode: 401, publicMessage: message, cause });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.", cause?: unknown) {
    super({ code: 'FORBIDDEN', statusCode: 403, publicMessage: message, cause });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found.', cause?: unknown) {
    super({ code: 'NOT_FOUND', statusCode: 404, publicMessage: message, cause });
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds?: number;

  constructor(message = 'Too many requests. Please slow down.', retryAfterSeconds?: number, cause?: unknown) {
    super({ code: 'RATE_LIMITED', statusCode: 429, publicMessage: message, cause });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ExternalServiceError extends AppError {
  readonly service: string;

  constructor(service: string, message?: string, cause?: unknown) {
    super({
      code: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 502,
      publicMessage: message ?? `Upstream service "${service}" is currently unavailable.`,
      cause,
    });
    this.service = service;
  }
}

export class QuotaExceededError extends AppError {
  constructor(message = 'You have reached your plan quota. Upgrade to continue.', cause?: unknown) {
    super({ code: 'QUOTA_EXCEEDED', statusCode: 402, publicMessage: message, cause });
  }
}

export class IntegrationDisconnectedError extends AppError {
  readonly provider: string;

  constructor(provider: string, message?: string, cause?: unknown) {
    super({
      code: 'INTEGRATION_DISCONNECTED',
      statusCode: 400,
      publicMessage: message ?? `Your ${provider} account is disconnected. Reconnect it to continue.`,
      cause,
    });
    this.provider = provider;
  }
}

export class WorkflowExecutionError extends AppError {
  readonly stepId?: string;

  constructor(message = 'Workflow step failed to execute.', stepId?: string, cause?: unknown) {
    super({ code: 'WORKFLOW_EXECUTION_ERROR', statusCode: 500, publicMessage: message, cause });
    this.stepId = stepId;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
