import { Router, Response } from 'express';
import prisma from '../../config/database';
import { createFieldSchema, updateFieldSchema, CreateFieldInput, UpdateFieldInput } from '../../utils/validation';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, notFoundError, errorResponse } from '../../utils/response';
import { Role } from '../../types/enums';
import logger from '../../config/logger';

const router = Router();

/**
 * @swagger
 * /api/v1/fields:
 *   post:
 *     summary: Create a new field
 *     description: Create a new agricultural field (Admin only)
 *     tags: [Fields]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFieldRequest'
 *     responses:
 *       201:
 *         description: Field created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Field'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post('/', authenticate, authorize(Role.ADMIN), validate(createFieldSchema), async (req, res: Response) => {
  try {
    const data = req.body as CreateFieldInput;

    const field = await prisma.field.create({
      data: {
        name: data.name,
        cropType: data.cropType,
        warningThreshold: data.warningThreshold || 10,
        criticalThreshold: data.criticalThreshold || 15,
      },
    });

    logger.info({ fieldId: field.id }, 'Field created');

    return successResponse(res, field, 'Field created successfully', 201);
  } catch (error) {
    logger.error({ error }, 'Error creating field');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/fields:
 *   get:
 *     summary: List all fields
 *     description: Get all fields (All authenticated users)
 *     tags: [Fields]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Field'
 */
router.get('/', authenticate, async (req, res: Response) => {
  try {
    const fields = await prisma.field.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, fields);
  } catch (error) {
    logger.error({ error }, 'Error fetching fields');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/fields/{id}:
 *   patch:
 *     summary: Update field
 *     description: Update field details (Admin only)
 *     tags: [Fields]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFieldRequest'
 *     responses:
 *       200:
 *         description: Field updated
 *       404:
 *         description: Field not found
 */
router.patch('/:id', authenticate, authorize(Role.ADMIN), validate(updateFieldSchema), async (req, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body as UpdateFieldInput;

    const field = await prisma.field.update({
      where: { id },
      data,
    });

    logger.info({ fieldId: id }, 'Field updated');

    return successResponse(res, field);
  } catch (error) {
    logger.error({ error, fieldId: req.params.id }, 'Error updating field');
    return notFoundError(res, 'Field not found');
  }
});

export default router;
