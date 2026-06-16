import { Request, Response } from 'express';
import prisma from '../config/db';
import { auth } from '../config/firebase';

// Helper to get date filters
function getDateFilter(range: string): Date {
  const now = new Date();
  switch (range) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(0); // All time
  }
}

// 1. Retrieve aggregated earnings & user counts
export async function getDashboardStats(req: Request, res: Response) {
  try {
    const totalUsers = await prisma.user.count();

    // Get total successful transactions filter-wise
    const getEarningsForFilter = async (range: string) => {
      const dateLimit = getDateFilter(range);
      const agg = await prisma.transaction.aggregate({
        _sum: {
          amount: true
        },
        where: {
          status: 'SUCCESS',
          createdAt: {
            gte: dateLimit
          }
        }
      });
      return agg._sum.amount || 0;
    };

    const earnings = {
      today: await getEarningsForFilter('today'),
      week: await getEarningsForFilter('week'),
      month: await getEarningsForFilter('month'),
      year: await getEarningsForFilter('year'),
      allTime: await getEarningsForFilter('all'),
    };

    return res.status(200).json({
      totalUsers,
      earnings,
    });
  } catch (err: any) {
    console.error('Error in getDashboardStats:', err);
    return res.status(500).json({ message: err.message || 'Error fetching dashboard stats.' });
  }
}

// 2. Users CRUD & Ban Toggles
export async function listUsers(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { videos: true, transactions: true }
        }
      }
    });
    return res.status(200).json(users);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Error fetching users.' });
  }
}

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

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, email, mobileNumber, password, planName, planValidity, createdBy, role, creditsBalance } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Update in Firebase Auth
    const fbUpdates: any = {};
    if (email) fbUpdates.email = email;
    if (name) fbUpdates.displayName = name;
    if (password) fbUpdates.password = password;

    if (Object.keys(fbUpdates).length > 0) {
      await auth.updateUser(id, fbUpdates);
    }

    // Determine plan expiration if updated
    let expiresAt = user.planExpiresAt;
    if (planValidity !== undefined && planValidity !== user.planValidity) {
      expiresAt = calculateExpiry(planValidity);
    }

    // Update in local database
    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: name !== undefined ? name : user.name,
        email: email !== undefined ? email : user.email,
        mobileNumber: mobileNumber !== undefined ? mobileNumber : user.mobileNumber,
        planName: planName !== undefined ? planName : user.planName,
        planValidity: planValidity !== undefined ? planValidity : user.planValidity,
        planExpiresAt: expiresAt,
        createdBy: createdBy !== undefined ? createdBy : user.createdBy,
        role: role !== undefined ? role : user.role,
        creditsBalance: creditsBalance !== undefined ? Number(creditsBalance) : user.creditsBalance,
      }
    });

    return res.status(200).json({ message: 'User updated successfully.', user: updated });
  } catch (err: any) {
    console.error('Error updating user:', err);
    return res.status(500).json({ message: err.message || 'Failed to update user.' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // Delete from Firebase
    try {
      await auth.deleteUser(id);
    } catch (fbErr: any) {
      console.warn('User not found in Firebase during deletion:', fbErr.message);
    }

    // Delete from Postgres (Cascade deletes transactions & videos due to relation definitions)
    await prisma.user.delete({ where: { id } });

    return res.status(200).json({ message: 'User account and associated data deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting user:', err);
    return res.status(500).json({ message: err.message || 'Failed to delete user.' });
  }
}

export async function toggleBanUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isBanned: !user.isBanned }
    });

    return res.status(200).json({
      message: `User ${updated.isBanned ? 'banned' : 'unbanned'} successfully.`,
      user: updated
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Failed to toggle ban state.' });
  }
}

// 3. Plan & Dynamic Pricing Feature management
export async function listPlansAdmin(req: Request, res: Response) {
  try {
    const plans = await prisma.plan.findMany({
      include: { features: true },
      orderBy: { price: 'asc' }
    });
    return res.status(200).json(plans);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Failed to list plans.' });
  }
}

export async function createPlan(req: Request, res: Response) {
  try {
    const { name, price, credits, features } = req.body;
    if (!name || price === undefined || credits === undefined) {
      return res.status(400).json({ message: 'Name, price, and credits are required.' });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        price: parseFloat(price.toString()),
        credits: parseInt(credits.toString(), 10),
        features: {
          create: (features || []).map((f: string) => ({
            text: f,
            isEnabled: true
          }))
        }
      },
      include: { features: true }
    });

    return res.status(201).json(plan);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Failed to create plan.' });
  }
}

export async function updatePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, price, credits, isActive } = req.body;

    const plan = await prisma.plan.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        price: price !== undefined ? parseFloat(price.toString()) : undefined,
        credits: credits !== undefined ? parseInt(credits.toString(), 10) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
      include: { features: true }
    });

    return res.status(200).json(plan);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Failed to update plan.' });
  }
}

export async function deletePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.plan.delete({ where: { id } });
    return res.status(200).json({ message: 'Plan deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Failed to delete plan.' });
  }
}

// 4. Feature management inside a plan
export async function addPlanFeature(req: Request, res: Response) {
  try {
    const { planId } = req.params;
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ message: 'Feature text is required.' });
    }

    const feature = await prisma.planFeature.create({
      data: {
        planId,
        text,
        isEnabled: true
      }
    });

    return res.status(201).json(feature);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Failed to add feature.' });
  }
}

export async function togglePlanFeature(req: Request, res: Response) {
  try {
    const { featureId } = req.params;
    const feature = await prisma.planFeature.findUnique({ where: { id: featureId } });
    if (!feature) {
      return res.status(404).json({ message: 'Feature not found.' });
    }

    const updated = await prisma.planFeature.update({
      where: { id: featureId },
      data: { isEnabled: !feature.isEnabled }
    });

    return res.status(200).json(updated);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Failed to toggle feature.' });
  }
}

export async function deletePlanFeature(req: Request, res: Response) {
  try {
    const { featureId } = req.params;
    await prisma.planFeature.delete({ where: { id: featureId } });
    return res.status(200).json({ message: 'Feature deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Failed to delete feature.' });
  }
}

// Resellers Management
export async function createReseller(req: Request, res: Response) {
  try {
    const { name, email, mobileNumber, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    let fbUser;
    try {
      fbUser = await auth.createUser({
        email,
        password,
        displayName: name,
        phoneNumber: mobileNumber ? (mobileNumber.startsWith('+') ? mobileNumber : `+${mobileNumber}`) : undefined
      });
    } catch (fbErr: any) {
      console.error('Firebase error creating reseller:', fbErr);
      return res.status(400).json({ message: fbErr.message || 'Auth provider registration failed.' });
    }

    const user = await prisma.user.create({
      data: {
        id: fbUser.uid,
        email,
        name,
        mobileNumber,
        role: 'RESELLER',
        creditsBalance: 0,
      }
    });

    return res.status(201).json({ message: 'Reseller appointed successfully.', user });
  } catch (err: any) {
    console.error('Error creating reseller:', err);
    return res.status(500).json({ message: err.message || 'Failed to appoint reseller.' });
  }
}

export async function listResellers(req: Request, res: Response) {
  try {
    const resellers = await prisma.user.findMany({
      where: { role: 'RESELLER' },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(resellers);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Failed to list resellers.' });
  }
}
