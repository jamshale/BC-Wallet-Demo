import type { Request, Response } from 'express'

import { Router } from 'express'
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import multer from 'multer'
import path from 'path'

import { requireRole } from '../middleware/requireAdmin'
import logger from '../utils/logger'

const router = Router()

/**
 * Sanitize SVG content by removing potentially dangerous elements and attributes
 * Removes: script tags, event handlers (on*), external references, style tags with expressions
 */
function sanitizeSVG(content: string): string {
  let sanitized = content
  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  // Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '')
  // Remove style tags that could contain expressions
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  // Remove external entity declarations
  sanitized = sanitized.replace(/<!ENTITY[^>]*>/gi, '')
  // Remove CDATA sections with potential code
  sanitized = sanitized.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
  // Remove href/xlink:href that reference javascript:
  sanitized = sanitized.replace(/\s+(href|xlink:href)\s*=\s*["']javascript:[^"']*["']/gi, '')
  return sanitized
}

// Configure multer for image file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      // Upload all images to /public/common so GET /admin/images can list them
      const commonDir = path.join(__dirname, '../public/common')
      cb(null, commonDir)
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
 * Upload a new image file to the public/common directory.
 * SVG files are sanitized server-side to remove potentially dangerous content.
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

    // Sanitize SVG files server-side
    const fileExtension = path.extname(req.file.filename).toLowerCase()
    if (fileExtension === '.svg') {
      try {
        const filePath = req.file.path
        const content = readFileSync(filePath, 'utf-8')
        const sanitized = sanitizeSVG(content)
        writeFileSync(filePath, sanitized, 'utf-8')
        logger.debug({ filename: req.file.filename }, 'SVG file sanitized')
      } catch (error) {
        logger.error(error, 'Error sanitizing SVG file')
        res.status(500).json({ error: 'Failed to sanitize SVG file' })
        return
      }
    }

    const relativePath = `/public/common/${req.file.filename}`
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
