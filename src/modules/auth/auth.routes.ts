import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router, Response } from 'express';
import prisma from '../../config/database';
import { loginSchema, registerSchema, LoginInput, RegisterInput } from '../../utils/validation';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, conflictError, notFoundError, errorResponse } from '../../utils/response';
import { Role } from '../../types/enums';
import logger from '../../config/logger';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user and receive JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', validate(loginSchema), async (req, res: Response) => {
  try {
    const { email, password } = req.body as LoginInput;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      logger.warn({ email }, 'Login attempt failed - invalid credentials');
      return errorResponse(res, 'Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      logger.warn({ email }, 'Login attempt failed - invalid password');
      return errorResponse(res, 'Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    logger.info({ userId: user.id, role: user.role }, 'User logged in successfully');

    return successResponse(res, {
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Login error');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register new user
 *     description: Create a new user account (Admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Admin only
 *       409:
 *         description: Email already registered
 */
router.post('/register', authenticate, authorize(Role.ADMIN), validate(registerSchema), async (req, res: Response) => {
  try {
    const { email, password, fullName, role } = req.body as RegisterInput;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return conflictError(res, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role: role || Role.WORKER,
      },
    });

    logger.info({ userId: user.id, role: user.role }, 'New user registered');

    return successResponse(res, {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    }, 'User registered successfully', 201);
  } catch (error) {
    logger.error({ error }, 'Registration error');
    return errorResponse(res);
  }
});

export default router;
