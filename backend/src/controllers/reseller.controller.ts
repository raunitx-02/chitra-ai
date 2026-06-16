import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../config/db';
import { auth } from '../config/firebase';

function calculateExpiry(validity: string): Date | null {
  if (!validity || validity === 'Lifetime' || validity === 'lifetime') {
    return null;
  }
  const now = new Date();
  switch (validity) {
    case '1 Month':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case '3 Months':
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    case '6 Months':
      return new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    case '1 Year':
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

// 1. List clients created by this reseller
export async function listResellerUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const resellerEmail = req.user?.email;
    if (!resellerEmail) {
      return res.status(401).json({ message: 'Unauthorized. No session email.' });
    }

    const users = await prisma.user.findMany({
      where: { createdBy: resellerEmail },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(users);
  } catch (err: any) {
    console.error('Error listing reseller clients:', err);
    return res.status(500).json({ message: err.message || 'Error listing clients.' });
  }
}

// 2. Create new client user
export async function createResellerUser(req: AuthenticatedRequest, res: Response) {
  try {
    const resellerEmail = req.user?.email;
    if (!resellerEmail) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const { email, password, name, mobileNumber, planName, planValidity } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password, and name are required.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Email is already in use.' });
    }

    // Register user in Firebase Auth
    let fbUser;
    try {
      fbUser = await auth.createUser({
        email,
        password,
        displayName: name,
        phoneNumber: mobileNumber ? (mobileNumber.startsWith('+') ? mobileNumber : `+${mobileNumber}`) : undefined
      });
    } catch (fbErr: any) {
      console.error('Firebase error creating user under reseller:', fbErr);
      return res.status(400).json({ message: fbErr.message || 'Failed to create login credentials.' });
    }

    // Map plan to starting credits:
    // BASIC -> 1000 credits
    // PRO -> 3000 credits
    // BUSINESS -> 7500 credits
    let startingCredits = 20;
    if (planName === 'BASIC') startingCredits = 1000;
    else if (planName === 'PRO') startingCredits = 3000;
    else if (planName === 'BUSINESS') startingCredits = 7500;

    // Save user to database
    const user = await prisma.user.create({
      data: {
        id: fbUser.uid,
        email,
        name,
        mobileNumber,
        createdBy: resellerEmail,
        planName: planName || 'None',
        planValidity: planValidity || 'Lifetime',
        planExpiresAt: calculateExpiry(planValidity || 'Lifetime'),
        creditsBalance: startingCredits
      }
    });

    return res.status(201).json({ message: 'Customer profile registered successfully.', user });
  } catch (err: any) {
    console.error('Error creating reseller client:', err);
    return res.status(500).json({ message: err.message || 'Failed to register customer.' });
  }
}

// 3. Update subscription details
export async function updateResellerUserPlan(req: AuthenticatedRequest, res: Response) {
  try {
    const resellerEmail = req.user?.email;
    const { id } = req.params;
    const { planName, planValidity } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.createdBy !== resellerEmail) {
      return res.status(403).json({ message: 'Forbidden. You do not own this client profile.' });
    }

    // Determine additional credits if upgrading
    let addedCredits = 0;
    if (planName !== user.planName) {
      if (planName === 'BASIC') addedCredits = 1000;
      else if (planName === 'PRO') addedCredits = 3000;
      else if (planName === 'BUSINESS') addedCredits = 7500;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        planName,
        planValidity,
        planExpiresAt: calculateExpiry(planValidity),
        creditsBalance: addedCredits > 0 ? { increment: addedCredits } : undefined
      }
    });

    return res.status(200).json({ message: 'Subscription tier updated successfully.', user: updated });
  } catch (err: any) {
    console.error('Error updating plan details:', err);
    return res.status(500).json({ message: err.message || 'Failed to update user subscription.' });
  }
}

// 4. Delete client user
export async function deleteResellerUser(req: AuthenticatedRequest, res: Response) {
  try {
    const resellerEmail = req.user?.email;
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.createdBy !== resellerEmail) {
      return res.status(403).json({ message: 'Forbidden. You do not own this client profile.' });
    }

    // Delete in Firebase Auth
    try {
      await auth.deleteUser(id);
    } catch (fbErr: any) {
      console.warn('Firebase login not found during client deletion:', fbErr.message);
    }

    // Delete database user
    await prisma.user.delete({ where: { id } });

    return res.status(200).json({ message: 'Client profile deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting client user:', err);
    return res.status(500).json({ message: err.message || 'Failed to delete user.' });
  }
}

// 5. Get reseller stats
export async function getResellerStats(req: AuthenticatedRequest, res: Response) {
  try {
    const resellerEmail = req.user?.email;
    if (!resellerEmail) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const myUsers = await prisma.user.findMany({
      where: { createdBy: resellerEmail }
    });

    const totalUsers = myUsers.length;
    const activeUsers = myUsers.filter(u => {
      if (u.planName === 'None') return false;
      if (u.planExpiresAt && new Date() > u.planExpiresAt) return false;
      return true;
    }).length;

    const plansCount: Record<string, number> = {
      None: 0,
      BASIC: 0,
      PRO: 0,
      BUSINESS: 0
    };

    myUsers.forEach(u => {
      const pName = u.planName || 'None';
      plansCount[pName] = (plansCount[pName] || 0) + 1;
    });

    return res.status(200).json({
      totalUsers,
      activeUsers,
      plansCount
    });
  } catch (err: any) {
    console.error('Error loading reseller metrics:', err);
    return res.status(500).json({ message: err.message || 'Error collecting metrics.' });
  }
}
