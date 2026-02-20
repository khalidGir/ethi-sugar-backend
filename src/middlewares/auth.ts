import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { unauthorizedError } from '../utils/response';
import { AuthRequest } from '../types/express';
import { Role } from '../types/enums';

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void | Response => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorizedError(res, 'No token provided');
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      id: string;
      email: string;
      role: Role;
    };
    req.user = decoded;
    next();
  } catch {
    return unauthorizedError(res, 'Invalid token');
  }
};

export const authorize = (...allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return unauthorizedError(res);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return unauthorizedError(res, 'Insufficient permissions');
    }

    next();
  };
};
