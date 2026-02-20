import { Response } from 'express';
import { ApiResponse } from '../types/express';
import logger from '../config/logger';

export const successResponse = (
  res: Response,
  data?: unknown,
  message = 'Success',
  statusCode = 200
): Response<ApiResponse> => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: Response,
  message = 'Internal Server Error',
  code = 'INTERNAL_ERROR',
  statusCode = 500
): Response<ApiResponse> => {
  logger.error({ message, code, statusCode }, 'API Error');
  return res.status(statusCode).json({
    success: false,
    message,
    code,
  });
};

export const validationError = (res: Response, message: string): Response<ApiResponse> => {
  return errorResponse(res, message, 'VALIDATION_ERROR', 400);
};

export const unauthorizedError = (res: Response, message = 'Unauthorized'): Response<ApiResponse> => {
  return errorResponse(res, message, 'UNAUTHORIZED', 401);
};

export const forbiddenError = (res: Response, message = 'Forbidden'): Response<ApiResponse> => {
  return errorResponse(res, message, 'FORBIDDEN', 403);
};

export const notFoundError = (res: Response, message = 'Resource not found'): Response<ApiResponse> => {
  return errorResponse(res, message, 'NOT_FOUND', 404);
};

export const conflictError = (res: Response, message: string): Response<ApiResponse> => {
  return errorResponse(res, message, 'CONFLICT', 409);
};
