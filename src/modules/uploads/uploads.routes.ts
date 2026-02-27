import { Router, Response } from 'express';
import { AuthRequest } from '../../types/express';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, errorResponse, notFoundError, badRequestError } from '../../utils/response';
import { Role } from '../../types/enums';
import logger from '../../config/logger';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';

const router = Router();

// Configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10') * 1024 * 1024; // 10MB default
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for memory storage
const storage = multer.memoryStorage();
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

// Simple file type validator
function validateFileType(file: Express.Multer.File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }
  return { valid: true };
}

// Generate unique filename
function generateFilename(originalName: string): string {
  const ext = path.extname(originalName);
  return `${uuidv4()}${ext}`;
}

/**
 * @swagger
 * /api/v1/uploads/image:
 *   post:
 *     summary: Upload an image
 *     description: Upload a field image (multipart/form-data)
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               fieldId:
 *                 type: string
 *                 format: uuid
 *               imageType:
 *                 type: string
 *                 enum: [disease, growth, general]
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Image uploaded successfully
 *       400:
 *         description: Validation error
 */
router.post('/image', authenticate, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    // Check if file exists in request
    if (!req.file) {
      return badRequestError(res, 'No image file provided');
    }

    const file = req.file as Express.Multer.File;
    const { fieldId, imageType = 'general', description } = req.body;

    // Validate file
    const validation = validateFileType(file);
    if (!validation.valid) {
      return badRequestError(res, validation.error!);
    }

    // Generate unique filename
    const filename = generateFilename(file.originalname);
    const filePath = path.join(UPLOAD_DIR, filename);

    // Move file to upload directory
    fs.writeFileSync(filePath, file.buffer);

    // Generate URL
    const imageUrl = `/uploads/${filename}`;

    // Store metadata
    const metadata = {
      id: uuidv4(),
      originalName: file.originalname,
      filename,
      mimetype: file.mimetype,
      size: file.size,
      uploadedBy: req.user!.id,
      uploadedByName: (req.user as any).fullName || 'Unknown',
      fieldId: fieldId || null,
      imageType,
      description: description || null,
      uploadedAt: new Date(),
    };

    logger.info({ uploadId: metadata.id, filename }, 'Image uploaded');

    return successResponse(res, {
      url: imageUrl,
      metadata,
    }, 'Image uploaded successfully', 201);
  } catch (error) {
    logger.error({ error }, 'Error uploading image');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/uploads/field/{fieldId}:
 *   get:
 *     summary: Get images for a field
 *     description: Get all images associated with a field
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fieldId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: imageType
 *         schema:
 *           type: string
 *           enum: [disease, growth, general]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Images retrieved successfully
 */
router.get('/field/:fieldId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fieldId } = req.params;
    const { imageType, startDate, endDate } = req.query;

    // In a real implementation, this would query a database
    // For now, we'll scan the uploads directory
    const uploadsDir = UPLOAD_DIR;
    
    if (!fs.existsSync(uploadsDir)) {
      return successResponse(res, { images: [], count: 0 });
    }

    const files = fs.readdirSync(uploadsDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
    });

    // Since we don't have a database for uploads, return basic file info
    const images = imageFiles.map(filename => ({
      filename,
      url: `/uploads/${filename}`,
      uploadedAt: fs.statSync(path.join(uploadsDir, filename)).birthtime,
    }));

    return successResponse(res, {
      images,
      count: images.length,
      fieldId,
    });
  } catch (error) {
    logger.error({ error, fieldId: req.params.fieldId }, 'Error fetching field images');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/uploads:
 *   get:
 *     summary: Get all uploaded images
 *     description: Get all uploaded images with optional filters
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: imageType
 *         schema:
 *           type: string
 *           enum: [disease, growth, general]
 *     responses:
 *       200:
 *         description: Images retrieved successfully
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { imageType } = req.query;

    const uploadsDir = UPLOAD_DIR;
    
    if (!fs.existsSync(uploadsDir)) {
      return successResponse(res, { images: [], count: 0 });
    }

    const files = fs.readdirSync(uploadsDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
    }).slice(0, limit);

    const images = imageFiles.map(filename => {
      const stats = fs.statSync(path.join(uploadsDir, filename));
      return {
        filename,
        url: `/uploads/${filename}`,
        size: stats.size,
        uploadedAt: stats.birthtime,
      };
    });

    return successResponse(res, {
      images,
      count: images.length,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching images');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/uploads/{id}:
 *   delete:
 *     summary: Delete an image
 *     description: Delete an uploaded image (ADMIN, AGRONOMIST only)
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           description: Image filename
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       404:
 *         description: Image not found
 *       403:
 *         description: Forbidden - ADMIN or AGRONOMIST only
 */
router.delete('/:id', authenticate, authorize(Role.ADMIN, Role.AGRONOMIST), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const filePath = path.join(UPLOAD_DIR, id);

    if (!fs.existsSync(filePath)) {
      return notFoundError(res, 'Image not found');
    }

    fs.unlinkSync(filePath);

    logger.info({ imageId: id }, 'Image deleted');

    return successResponse(res, null, 'Image deleted successfully');
  } catch (error) {
    logger.error({ error, imageId: req.params.id }, 'Error deleting image');
    return notFoundError(res, 'Image not found');
  }
});

export default router;
