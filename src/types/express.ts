import { Request } from 'express';
import { Role } from '../types/enums';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  code?: string;
  data?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
