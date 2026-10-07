import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './db.ts';

const SECRET = process.env.SESSION_SECRET || 'petroflow-lubricant-erp-jwt-secret-2026';

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  role_slug: string;
  mobile?: string;
  employee_id?: string;
  avatar_url?: string;
  permissions: string[];
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(userId: number): string {
  const payload = JSON.stringify({ userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64url') + '.' + hmac;
}

export function verifyToken(token: string): number | null {
  try {
    const [payloadB64, hmac] = token.split('.');
    if (!payloadB64 || !hmac) return null;
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const expectedHmac = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('hex');
    if (hmac !== expectedHmac) return null;
    const payload = JSON.parse(payloadStr);
    if (payload.exp < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export function getUserWithPermissions(userId: number): AuthenticatedUser | null {
  const userRow = db.prepare(`
    SELECT u.id, u.name, u.email, u.role_id, u.mobile, u.employee_id, u.avatar_url, u.status,
           r.name as role_name, r.slug as role_slug
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ? AND u.status = 'active'
  `).get(userId) as any;

  if (!userRow) return null;

  const perms = db.prepare(`
    SELECT p.code
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
  `).all(userRow.role_id) as { code: string }[];

  const permCodes = perms.map(p => p.code);
  const allCodes = new Set<string>();
  for (const c of permCodes) {
    allCodes.add(c);
    allCodes.add(c.replace(/:/g, '.'));
    allCodes.add(c.replace(/\./g, ':'));
  }

  return {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    role_id: userRow.role_id,
    role_name: userRow.role_name,
    role_slug: userRow.role_slug,
    mobile: userRow.mobile,
    employee_id: userRow.employee_id,
    avatar_url: userRow.avatar_url,
    permissions: Array.from(allCodes)
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  let token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  const user = getUserWithPermissions(userId);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User not found or inactive' });
  }

  req.user = user;
  next();
}

export function requirePermission(...permissionCodes: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Super admin has all permissions
    if (req.user.role_slug === 'super_admin') {
      return next();
    }
    const userPerms = req.user.permissions || [];
    const hasAny = permissionCodes.some(code => {
      const colonCode = code.replace(/\./g, ':');
      const dotCode = code.replace(/:/g, '.');
      return userPerms.includes(code) || userPerms.includes(colonCode) || userPerms.includes(dotCode);
    });

    if (hasAny) {
      return next();
    }
    return res.status(403).json({ error: `Forbidden: Missing required permission (${permissionCodes.join(' or ')})` });
  };
}
