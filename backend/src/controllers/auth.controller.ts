import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../config/db';

export async function syncUser(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    let dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name || '',
          avatarUrl: user.avatarUrl || '',
          creditsBalance: 100, // 100 starting credits
        },
      });
    } else {
      // Sync names/avatars if changed
      dbUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: user.name || dbUser.name,
          avatarUrl: user.avatarUrl || dbUser.avatarUrl,
        },
      });
    }

    return res.status(200).json({
      message: 'User synced successfully',
      user: dbUser,
    });
  } catch (error: any) {
    console.error('Error syncing user:', error);
    return res.status(500).json({ message: error.message || 'Error syncing user' });
  }
}

export async function getUserProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        videos: { orderBy: { createdAt: 'desc' } },
        transactions: { orderBy: { createdAt: 'desc' } }
      }
    });

    return res.status(200).json({ user: dbUser });
  } catch (error) {
    return res.status(500).json({ message: 'Error retrieving profile data' });
  }
}
