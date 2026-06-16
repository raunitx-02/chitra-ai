import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import prisma from '../config/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    role?: string;
  };
}

export async function protect(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    // Verify token with Firebase
    const decodedToken = await auth.verifyIdToken(token);
    
    // Find or create the user in local Postgres DB to keep it in sync
    let user = await prisma.user.findUnique({
      where: { id: decodedToken.uid },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: decodedToken.uid,
          email: decodedToken.email || '',
          name: decodedToken.name || '',
          avatarUrl: decodedToken.picture || '',
          creditsBalance: 20, // 20 starting credits for trials
        },
      });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'Your account has been banned. Please contact support.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      avatarUrl: user.avatarUrl || undefined,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Authentication Error:', error);
    res.status(401).json({ message: 'Not authorized, token verification failed' });
  }
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden. Admin access required.' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Server error verifying admin role.' });
  }
}

export async function requireReseller(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user || (user.role !== 'RESELLER' && user.role !== 'ADMIN')) {
      return res.status(403).json({ message: 'Forbidden. Reseller access required.' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Server error verifying reseller role.' });
  }
}
