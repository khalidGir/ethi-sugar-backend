import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { validationError } from '../utils/response';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        return validationError(res, messages.join(', '));
      }
      return validationError(res, 'Invalid input');
    }
  };
};
