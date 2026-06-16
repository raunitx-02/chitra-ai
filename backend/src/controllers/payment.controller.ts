import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../config/db';
import razorpay from '../config/razorpay';
import crypto from 'crypto';

// 1. Get active plans (with auto-seeding if database has 0 plans)
export async function listPlans(req: Request, res: Response) {
  try {
    let plans = await prisma.plan.findMany({
      where: { isActive: true },
      include: { features: true },
      orderBy: { price: 'asc' }
    });

    if (plans.length === 0) {
      console.log('[Seed] No plans found in database. Seeding default plans...');
      
      const basicPlan = await prisma.plan.create({
        data: {
          name: 'BASIC',
          price: 1999,
          credits: 1000,
          features: {
            create: [
              { text: '1,000 video generation credits', isEnabled: true },
              { text: 'Access to cosmetic avatars', isEnabled: true },
              { text: 'Hindi & English voice styles', isEnabled: true },
              { text: 'Standard rendering priority', isEnabled: true },
            ]
          }
        },
        include: { features: true }
      });

      const proPlan = await prisma.plan.create({
        data: {
          name: 'PRO',
          price: 4999,
          credits: 3000,
          features: {
            create: [
              { text: '3,000 video generation credits', isEnabled: true },
              { text: 'Access to premium cosmetic avatars', isEnabled: true },
              { text: 'Hindi, Tamil, Telugu & English voices', isEnabled: true },
              { text: 'Priority rendering queue (5x faster)', isEnabled: true },
              { text: 'Dedicated 24/7 email support', isEnabled: true },
            ]
          }
        },
        include: { features: true }
      });

      const businessPlan = await prisma.plan.create({
        data: {
          name: 'BUSINESS',
          price: 9999,
          credits: 7500,
          features: {
            create: [
              { text: '7,500 video generation credits', isEnabled: true },
              { text: 'Custom avatar cloning options', isEnabled: true },
              { text: 'API developer access keys', isEnabled: true },
              { text: 'Dedicated campaign manager', isEnabled: true },
            ]
          }
        },
        include: { features: true }
      });

      plans = [basicPlan, proPlan, businessPlan];
    }

    return res.status(200).json(plans);
  } catch (err: any) {
    console.error('Error fetching plans:', err);
    return res.status(500).json({ message: err.message || 'Error retrieving plans.' });
  }
}

// 2. Create Checkout Order: POST /api/payments/order
export async function createOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { plan: planName } = req.body;
    if (!planName) {
      return res.status(400).json({ message: 'Plan is required.' });
    }

    // Lookup plan dynamically from Database
    const dbPlan = await prisma.plan.findFirst({
      where: {
        name: planName,
        isActive: true
      }
    });

    if (!dbPlan) {
      return res.status(400).json({ message: 'Invalid or inactive plan selected.' });
    }

    const amountInPaise = Math.round(dbPlan.price * 100);

    // Create Razorpay Order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_plan_${dbPlan.name}_${Date.now()}`,
    });

    // Save PENDING transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: dbPlan.price,
        creditsGranted: dbPlan.credits,
        razorpayOrderId: order.id,
        status: 'PENDING',
      },
    });

    return res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkeyid',
    });
  } catch (error: any) {
    console.error('Error creating payment order:', error);
    return res.status(500).json({ message: error.message || 'Error processing request.' });
  }
}

// 3. Verify Payment Checkout Signature: POST /api/payments/verify
export async function verifyPayment(req: AuthenticatedRequest, res: Response) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment checkout tokens.' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || 'mocksecretkey';
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ message: 'Signature verification failed.' });
    }

    // Find and update transaction
    const tx = await prisma.transaction.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!tx || tx.status === 'SUCCESS') {
      return res.status(404).json({ message: 'Transaction already processed or not found.' });
    }

    // Transactionally update database
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'SUCCESS', razorpayPaymentId: razorpay_payment_id },
      }),
      prisma.user.update({
        where: { id: tx.userId },
        data: { creditsBalance: { increment: tx.creditsGranted } },
      }),
    ]);

    return res.status(200).json({
      status: 'success',
      message: 'Credits added successfully.',
      creditsGranted: tx.creditsGranted,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: 'Verification error' });
  }
}
