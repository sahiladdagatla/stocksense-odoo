/** An expected, client-facing error. Rendered by the error middleware as `{ error: { code, message } }`. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST') =>
  new AppError(400, code, message);
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);
export const forbidden = (message = 'You do not have permission to do this', code = 'FORBIDDEN') =>
  new AppError(403, code, message);
export const notFound = (message = 'Not found', code = 'NOT_FOUND') =>
  new AppError(404, code, message);
export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);
export const unprocessable = (message: string, code: string) => new AppError(422, code, message);
