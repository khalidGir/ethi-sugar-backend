/**
 * Role Guard Middleware - Unit Tests
 * Tests the authentication and authorization middleware
 */

import { describe, it, expect, beforeEach, vi } from '@jest/globals';

// Mock dependencies
vi.mock('jsonwebtoken', () => ({
  verify: vi.fn(),
}));

vi.mock('../../config/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/express';
import { authenticate, authorize } from '../../middlewares/auth';
import { unauthorizedError } from '../../utils/response';

// Mock process.env
const originalEnv = process.env;

describe('Role Guard Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret-key-12345' };
    mockRequest = {
      headers: {},
      user: undefined,
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('authenticate', () => {
    it('should call unauthorizedError if no authorization header', () => {
      authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(unauthorizedError).toHaveBeenCalledWith(mockResponse, 'No token provided');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call unauthorizedError if header does not start with Bearer', () => {
      mockRequest.headers = { authorization: 'Basic abc123' };

      authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(unauthorizedError).toHaveBeenCalledWith(mockResponse, 'No token provided');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next with valid token', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      };

      vi.mocked(jwt.verify).mockReturnValue(mockUser);
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret-key-12345');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call unauthorizedError if token is invalid', () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      mockRequest.headers = { authorization: 'Bearer invalid-token' };

      authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(unauthorizedError).toHaveBeenCalledWith(mockResponse, 'Invalid token');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call unauthorizedError if JWT_SECRET is not defined', () => {
      process.env.JWT_SECRET = undefined;
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      expect(() => {
        authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      }).toThrow('JWT_SECRET is not defined in environment variables');
    });
  });

  describe('authorize', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should call next if user role is in allowed roles', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      };

      const authorizeMiddleware = authorize('ADMIN', 'SUPERVISOR');
      authorizeMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call unauthorizedError if user role is not in allowed roles', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'WORKER',
      };

      const authorizeMiddleware = authorize('ADMIN', 'SUPERVISOR');
      authorizeMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(unauthorizedError).toHaveBeenCalledWith(mockResponse, 'Insufficient permissions');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call unauthorizedError if user is not authenticated', () => {
      mockRequest.user = undefined;

      const authorizeMiddleware = authorize('ADMIN');
      authorizeMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(unauthorizedError).toHaveBeenCalledWith(mockResponse);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow multiple roles', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'SUPERVISOR',
      };

      const authorizeMiddleware = authorize('ADMIN', 'SUPERVISOR', 'WORKER');
      authorizeMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should work with single role', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      };

      const authorizeMiddleware = authorize('ADMIN');
      authorizeMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Role Access Scenarios', () => {
    const createMockUser = (role: string) => ({
      id: 'user-123',
      email: `${role.toLowerCase()}@example.com`,
      role,
    });

    it('ADMIN should have access to all roles', () => {
      const adminUser = createMockUser('ADMIN');

      ['ADMIN', 'SUPERVISOR', 'WORKER'].forEach((allowedRole) => {
        mockRequest.user = adminUser;
        vi.clearAllMocks();

        const authorizeMiddleware = authorize(allowedRole as any);
        authorizeMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    it('SUPERVISOR should not have ADMIN-only access', () => {
      mockRequest.user = createMockUser('SUPERVISOR');

      const authorizeMiddleware = authorize('ADMIN');
      authorizeMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(unauthorizedError).toHaveBeenCalledWith(mockResponse, 'Insufficient permissions');
    });

    it('WORKER should only have WORKER access', () => {
      mockRequest.user = createMockUser('WORKER');

      // Should pass for WORKER
      let authorizeMiddleware = authorize('WORKER');
      authorizeMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Should fail for ADMIN
      vi.clearAllMocks();
      authorizeMiddleware = authorize('ADMIN');
      authorizeMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(unauthorizedError).toHaveBeenCalledWith(mockResponse, 'Insufficient permissions');
    });
  });
});
