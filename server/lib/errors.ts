export class AppError extends Error {
  status: number;
  extras?: Record<string, unknown>;

  constructor(
    message: string,
    status = 500,
    extras?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.extras = extras;
  }
}
