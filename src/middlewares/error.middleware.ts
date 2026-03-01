import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Global error handler middleware
 * Must be registered last in Express app
 */
export const errorHandler = (
    err: Error | AppError,
    _req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction
): void => {
    const isDev = process.env.NODE_ENV === 'development';

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            ...(isDev && { stack: err.stack }),
        });
        return;
    }

    // Multer file size error
    if (err.message?.includes('File too large')) {
        res.status(413).json({
            success: false,
            message: 'File too large. Maximum allowed size is 5MB.',
        });
        return;
    }

    // Multer file type error
    if (err.message?.includes('Invalid file type')) {
        res.status(400).json({
            success: false,
            message: err.message,
        });
        return;
    }

    // Generic internal error
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(isDev && { error: err.message, stack: err.stack }),
    });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (_req: Request, res: Response): void => {
    res.status(404).json({
        success: false,
        message: `Route not found`,
    });
};
