/**
 * A BE call that answered outside 2xx, or with no response envelope. Its own
 * module so code that only inspects errors (lib/actionErrors.ts) needn't load
 * the server-only client and the session behind it.
 */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
  get notFound(): boolean {
    return this.status === 404;
  }
}
