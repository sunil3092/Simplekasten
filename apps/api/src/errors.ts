import { Response } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function handleError(error: unknown, res: Response) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (error instanceof Error) {
    console.error("Unexpected error:", error.message);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    });
  }

  console.error("Unknown error:", error);
  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
}

// Common error factories
export const Errors = {
  unauthorized: () => new AppError(401, "UNAUTHORIZED", "Unauthorized"),
  notFound: (resource: string) =>
    new AppError(404, "NOT_FOUND", `${resource} not found`),
  conflict: (message: string) => new AppError(409, "CONFLICT", message),
  badRequest: (message: string) => new AppError(400, "BAD_REQUEST", message),
  forbidden: () => new AppError(403, "FORBIDDEN", "Forbidden"),
};
