import type { Request, Response } from 'express'

import { Router } from 'express'
import { readdirSync } from 'fs'
import multer from 'multer'
import path from 'path'

import { requireRole } from '../middleware/requireAdmin'
import logger from '../utils/logger'

const router = Router()

// Configure multer for image file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const publicDir = path.join(__dirname, '../public')
      cb(null, publicDir)
    },
    filename: (_req, file, cb) => {
      // Sanitize filename
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
      cb(null, sanitizedName)
    },
  }),
  fileFilter: (_req, file, cb) => {
    // Allow image files: SVG, PNG, JPG, JPEG, GIF, WEBP
    const allowedExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']
    const fileExtension = path.extname(file.originalname).toLowerCase()

    if (!allowedExtensions.includes(fileExtension)) {
      cb(new Error('Only image files (SVG, PNG, JPG, JPEG, GIF, WEBP) are allowed'))
      return
    }
    cb(null, true)
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
})

/**
 * GET /admin/images
 * List all available image files in the public/common directory.
 * Requires: admin or creator or viewer role
 */
router.get('/', requireRole(['admin', 'creator', 'viewer']), (_req: Request, res: Response) => {
  logger.debug('Admin: list available image files')

  try {
    const commonDir = path.join(__dirname, '../public/common')
    const files = readdirSync(commonDir)

    // Filter for image files
    const allowedExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']
    const availableImages = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase()
        return allowedExtensions.includes(ext)
      })
      .map((file) => `/public/common/${file}`)

    res.json({ files: availableImages })
  } catch (error) {
    logger.error(error, 'Error reading images directory')
    res.status(500).json({ error: 'Failed to read images directory' })
  }
})

/**
 * POST /admin/images
 * Upload a new image file to the public directory.
 * Requires: admin or creator role
 */
router.post(
  '/',
  requireRole(['admin', 'creator']),
  upload.single('file'),
  (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' })
      return
    }

    logger.debug({ filename: req.file.filename }, 'Admin: upload image file')

    const relativePath = `/public/${req.file.filename}`
    res.status(201).json({
      message: 'Image file uploaded successfully',
      path: relativePath,
      filename: req.file.filename,
    })
  },
  (error: Error, _req: Request, res: Response) => {
    // Multer error handler
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File size must be less than 5MB' })
        return
      }
    }

    if (error.message.includes('only image files')) {
      res.status(400).json({ error: error.message })
      return
    }

    logger.error(error, 'File upload error')
    res.status(500).json({ error: 'File upload failed' })
  },
)

export default router
