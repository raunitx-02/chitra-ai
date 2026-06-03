import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../config/db';
import razorpay from '../config/razorpay';
import crypto from 'crypto';

// Plans mapping
const PLANS: Record<'BASIC' | 'PRO', { price: number; credits: number }> = {
  BASIC: { price: 1999, credits: 1000 },
  PRO: { price: 4999, credits: 3000 },
};

// 1. Create Checkout Order: POST /api/payments/order
export async function createOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { plan } = req.body;
    if (plan !== 'BASIC' && plan !== 'PRO') {
      return res.status(400).json({ message: 'Invalid plan selected.' });
    }

    const selectedPlan = PLANS[plan as 'BASIC' | 'PRO'];
    const amountInPaise = selectedPlan.price * 100;

    // Create Razorpay Order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_plan_${plan}_${Date.now()}`,
    });

    // Save PENDING transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: parseFloat(selectedPlan.price.toString()),
        creditsGranted: selectedPlan.credits,
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

// 2. Verify Payment Checkout Signature: POST /api/payments/verify
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
