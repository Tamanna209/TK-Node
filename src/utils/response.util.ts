import { Response } from 'express';
import { ApiResponse } from '../types/common.types';

export const sendSuccess = <T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode = 200
): void => {
    const response: ApiResponse<T> = { success: true, message, data };
    res.status(statusCode).json(response);
};

export const sendError = (
    res: Response,
    message = 'An error occurred',
    statusCode = 500,
    error?: string
): void => {
    const response: ApiResponse = { success: false, message, error };
    res.status(statusCode).json(response);
};
