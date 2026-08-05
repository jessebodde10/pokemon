/**
 * Typed application errors.
 *
 * Every error carries a `userMessage` in Dutch that is safe to render. Raw
 * messages, stack traces and provider payloads stay on the server.
 */

export type AppErrorCode =
  | 'UPLOAD_VALIDATION'
  | 'ANALYSIS_NOT_FOUND'
  | 'UNAUTHORIZED_ANALYSIS_ACCESS'
  | 'RECOGNITION_PROVIDER'
  | 'CATALOG_PROVIDER'
  | 'PRICING_PROVIDER'
  | 'INSUFFICIENT_PRICING_DATA'
  | 'RATE_LIMITED'
  | 'INVALID_STATE_TRANSITION'
  | 'AUTH_REQUIRED'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly userMessage: string;
  readonly httpStatus: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    userMessage: string,
    httpStatus = 400,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.userMessage = userMessage;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export class UploadValidationError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(
      'UPLOAD_VALIDATION',
      message,
      'Deze afbeelding kunnen we niet verwerken. Gebruik JPG, PNG of WEBP van maximaal 10 MB.',
      422,
      details,
    );
  }
}

export class AnalysisNotFoundError extends AppError {
  constructor(sessionId: string) {
    super(
      'ANALYSIS_NOT_FOUND',
      `Analysis session ${sessionId} not found`,
      'Deze analyse bestaat niet meer. Gastanalyses worden na 24 uur automatisch verwijderd.',
      404,
    );
  }
}

export class UnauthorizedAnalysisAccessError extends AppError {
  constructor(sessionId: string) {
    super(
      'UNAUTHORIZED_ANALYSIS_ACCESS',
      `Access denied for analysis session ${sessionId}`,
      'Je hebt geen toegang tot deze analyse.',
      403,
    );
  }
}

export class AuthRequiredError extends AppError {
  constructor() {
    super(
      'AUTH_REQUIRED',
      'Authentication required',
      'Log in om deze pagina te bekijken.',
      401,
    );
  }
}

export class RecognitionProviderError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(
      'RECOGNITION_PROVIDER',
      message,
      'We konden een deel van de kaarten niet betrouwbaar herkennen. Je kunt ze handmatig toevoegen of een scherpere foto uploaden.',
      502,
      details,
    );
  }
}

export class CatalogProviderError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(
      'CATALOG_PROVIDER',
      message,
      'De kaartcatalogus is tijdelijk niet bereikbaar. Probeer het later opnieuw of zoek de kaart handmatig op.',
      502,
      details,
    );
  }
}

export class PricingProviderError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(
      'PRICING_PROVIDER',
      message,
      'We konden de marktinformatie nu niet ophalen. De kaarten blijven bewaard; je kunt de prijzen later vernieuwen.',
      502,
      details,
    );
  }
}

export class InsufficientPricingDataError extends AppError {
  constructor(reason: string, details: Record<string, unknown> = {}) {
    super(
      'INSUFFICIENT_PRICING_DATA',
      `Insufficient pricing data: ${reason}`,
      'Onvoldoende marktdata voor een betrouwbare schatting.',
      200,
      details,
    );
  }
}

export class RateLimitedError extends AppError {
  constructor(userMessage: string, details: Record<string, unknown> = {}) {
    super('RATE_LIMITED', 'Rate limit exceeded', userMessage, 429, details);
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(
      'INVALID_STATE_TRANSITION',
      `Invalid transition ${from} -> ${to}`,
      'Deze actie is in de huidige status van de analyse niet mogelijk.',
      409,
      { from, to },
    );
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

const GENERIC_USER_MESSAGE =
  'Er ging iets mis aan onze kant. Probeer het opnieuw; als het blijft gebeuren, upload dan een nieuwe foto.';

/** Convert any thrown value into a message that is safe to show a user. */
export function toUserMessage(error: unknown): string {
  return isAppError(error) ? error.userMessage : GENERIC_USER_MESSAGE;
}

export function toErrorCode(error: unknown): AppErrorCode {
  return isAppError(error) ? error.code : 'UNKNOWN';
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AppErrorCode; message: string };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(error: unknown): ActionResult<never> {
  return { ok: false, code: toErrorCode(error), message: toUserMessage(error) };
}
