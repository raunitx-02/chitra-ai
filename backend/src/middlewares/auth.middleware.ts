import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import prisma from '../config/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
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
          creditsBalance: 100, // 100 starting credits
        },
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      avatarUrl: user.avatarUrl || undefined,
    };

    next();
  } catch (error) {
    console.error('Authentication Error:', error);
    res.status(401).json({ message: 'Not authorized, token verification failed' });
  }
}
