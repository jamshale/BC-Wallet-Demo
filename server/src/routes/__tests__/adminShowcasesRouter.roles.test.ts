import type { NextFunction, Request, Response } from 'express'

import express, { json } from 'express'
import request from 'supertest'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Use vi.hoisted to define mocks outside vi.mock() but at top level
const { mocks } = vi.hoisted(() => {
  return {
    mocks: {
      mockShowcaseController: {
        getShowcases: vi.fn(),
        getShowcaseById: vi.fn(),
      },
      mockAdminShowcaseController: {
        createShowcase: vi.fn(),
        updateShowcase: vi.fn(),
        deleteShowcase: vi.fn(),
      },
    },
  }
})

vi.mock('typedi', () => ({
  Container: {
    get: (Type: any) => {
      if (Type.name === 'ShowcaseController') return mocks.mockShowcaseController
      if (Type.name === 'AdminShowcaseController') return mocks.mockAdminShowcaseController
      return {}
    },
  },
  Service: () => (target: any) => target,
}))

// Create a real requireRole middleware mock that checks roles
function createMockRequireRole() {
  return (allowedRoles: string[]) => (req: any, res: Response, next: NextFunction) => {
    const auth = req.auth
    if (!auth) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const userRoles = auth.realm_access?.roles || []
    const hasRequiredRole = allowedRoles.some((role) => userRoles.includes(role))

    if (!hasRequiredRole) {
      return res.status(403).json({ error: 'Insufficient role privileges' })
    }

    next()
  }
}

vi.mock('../../middleware/requireAdmin', () => ({
  requireRole: createMockRequireRole(),
}))

import adminShowcasesRouter from '../adminShowcasesRouter'

/**
 * Helper to create an Express app with proper role-based access control testing.
 */
function createAppWithRoles() {
  const app = express()
  app.use(json())

  // Attach auth from test header
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const auth = req.headers['x-test-auth']
    if (auth) {
      try {
        req.auth = JSON.parse(String(auth))
      } catch {
        // Ignore parse errors
      }
    }
    next()
  })

  app.use('/admin/showcases', adminShowcasesRouter)
  return app
}

const mockShowcase = {
  _id: 'test-id',
  name: 'student',
  persona: { name: 'Student', type: 'student', image: '/image.svg' },
  credentials: [],
  introduction: [],
  progressBar: [],
  scenarios: [],
}

describe('adminShowcasesRouter with role-based access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockShowcaseController.getShowcases.mockResolvedValue([mockShowcase])
    mocks.mockAdminShowcaseController.createShowcase.mockResolvedValue(mockShowcase)
    mocks.mockAdminShowcaseController.updateShowcase.mockResolvedValue(mockShowcase)
    mocks.mockAdminShowcaseController.deleteShowcase.mockResolvedValue(undefined)
  })

  describe('GET /admin/showcases (requires viewer|creator|admin role)', () => {
    it('returns 200 when user has viewer role', async () => {
      const app = createAppWithRoles()
      const auth = { sub: 'user1', realm_access: { roles: ['viewer'] } }
      const res = await request(app).get('/admin/showcases').set('x-test-auth', JSON.stringify(auth))
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('returns 403 when user does not have required role', async () => {
      const app = createAppWithRoles()
      const auth = { sub: 'user1', realm_access: { roles: ['user'] } }
      const res = await request(app).get('/admin/showcases').set('x-test-auth', JSON.stringify(auth))
      expect(res.status).toBe(403)
      expect(res.body).toHaveProperty('error')
    })

    it('returns 401 when no auth provided', async () => {
      const app = createAppWithRoles()
      const res = await request(app).get('/admin/showcases')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /admin/showcases (requires admin or creator role)', () => {
    it('returns 201 when user has admin role', async () => {
      const app = createAppWithRoles()
      const auth = { sub: 'user1', realm_access: { roles: ['admin'] } }
      const res = await request(app).post('/admin/showcases').set('x-test-auth', JSON.stringify(auth)).send({
        name: 'New Showcase',
      })
      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('name', 'student')
    })

    it('returns 201 when user has creator role', async () => {
      const app = createAppWithRoles()
      const auth = { sub: 'user1', realm_access: { roles: ['creator'] } }
      const res = await request(app).post('/admin/showcases').set('x-test-auth', JSON.stringify(auth)).send({
        name: 'New Showcase',
      })
      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('name', 'student')
    })

    it('returns 403 when user does not have admin or creator role', async () => {
      const app = createAppWithRoles()
      const auth = { sub: 'user1', realm_access: { roles: ['viewer'] } }
      const res = await request(app).post('/admin/showcases').set('x-test-auth', JSON.stringify(auth)).send({
        name: 'New Showcase',
      })
      expect(res.status).toBe(403)
    })

    it('returns 401 when no auth provided', async () => {
      const app = createAppWithRoles()
      const res = await request(app).post('/admin/showcases').send({ name: 'New Showcase' })
      expect(res.status).toBe(401)
    })
  })

  describe('PUT /admin/showcases/:id (requires admin or creator role)', () => {
    it('returns 200 when user has admin role', async () => {
      const app = createAppWithRoles()
      const auth = { sub: 'user1', realm_access: { roles: ['admin'] } }
      const res = await request(app)
        .put('/admin/showcases/student')
        .set('x-test-auth', JSON.stringify(auth))
        .send({ name: 'Updated' })
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('name', 'student')
    })

    it('returns 200 when user has creator role', async () => {
      const app = createAppWithRoles()
      const auth = { sub: 'user1', realm_access: { roles: ['creator'] } }
      const res = await request(app)
        .put('/admin/showcases/student')
        .set('x-test-auth', JSON.stringify(auth))
        .send({ name: 'Updated' })
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('name', 'student')
    })

    it('returns 403 when user has viewer role', async () => {
      const app = createAppWithRoles()
      const auth = { sub: 'user1', realm_access: { roles: ['viewer'] } }
      const res = await request(app)
        .put('/admin/showcases/student')
        .set('x-test-auth', JSON.stringify(auth))
        .send({ name: 'Updated' })
      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /admin/showcases/:id (requires admin role only)', () => {
    it('returns 204 when user has admin role', async () => {
      const app = createAppWithRoles()
      const auth = { sub: 'user1', realm_access: { roles: ['admin'] } }
      const res = await request(app).delete('/admin/showcases/student').set('x-test-auth', JSON.stringify(auth))
      expect(res.status).toBe(204)
      expect(res.body).toEqual({})
    })

    it('returns 403 when user has creator role', async () => {
      const app = createAppWithRoles()
      const auth = { sub: 'user1', realm_access: { roles: ['creator'] } }
      const res = await request(app).delete('/admin/showcases/student').set('x-test-auth', JSON.stringify(auth))
      expect(res.status).toBe(403)
    })

    it('returns 403 when user has viewer role', async () => {
      const app = createAppWithRoles()
      const auth = { sub: 'user1', realm_access: { roles: ['viewer'] } }
      const res = await request(app).delete('/admin/showcases/student').set('x-test-auth', JSON.stringify(auth))
      expect(res.status).toBe(403)
    })
  })
})
