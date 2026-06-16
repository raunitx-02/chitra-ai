import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../config/db';
import { auth } from '../config/firebase';
import { sendSMSOtp } from '../services/sms.service';

// Temporary in-memory stores (with 5 min expiry)
interface TempUserData {
  name: string;
  email: string;
  mobileNumber: string;
  passwordHash: string;
  otp: string;
  expiresAt: number;
}

const tempSignups: Record<string, TempUserData> = {};
const tempLogins: Record<string, { otp: string; expiresAt: number }> = {};

// Helper to format phone number to include '+'
function formatPhoneNumber(phone: string): string {
  const clean = phone.trim().replace(/[^\d+]/g, '');
  if (clean.startsWith('+')) return clean;
  // Fallback if no country code prefix: default to +91 (or similar) or simply add +
  return `+${clean}`;
}

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
          creditsBalance: 20, // 20 starting credits for trial
        },
      });
    } else {
      if (dbUser.isBanned) {
        return res.status(403).json({ message: 'Your account has been banned. Please contact support.' });
      }
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
      mobileBound: !!dbUser.mobileNumber,
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

    if (!dbUser) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    if (dbUser.isBanned) {
      return res.status(403).json({ message: 'Your account has been banned. Please contact support.' });
    }

    return res.status(200).json({
      user: dbUser,
      mobileBound: !!dbUser.mobileNumber,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error retrieving profile data' });
  }
}

// 1. Request OTP for Signup
export async function registerRequest(req: Request, res: Response) {
  try {
    const { name, email, mobileNumber, password } = req.body;

    if (!name || !email || !mobileNumber || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email address is already registered.' });
    }

    // Check if mobile number already exists
    const existingMobile = await prisma.user.findFirst({
      where: { mobileNumber },
    });
    if (existingMobile) {
      return res.status(400).json({ message: 'Mobile number is already registered.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store in-memory
    tempSignups[mobileNumber] = {
      name,
      email,
      mobileNumber,
      passwordHash: password,
      otp,
      expiresAt,
    };

    // Send SMS OTP
    const isRealSMS = await sendSMSOtp(mobileNumber, otp);

    return res.status(200).json({
      message: 'Verification OTP sent to mobile number.',
      debugOtp: !isRealSMS ? otp : undefined
    });
  } catch (err: any) {
    console.error('Error in registerRequest:', err);
    return res.status(500).json({ message: err.message || 'Error processing registration request.' });
  }
}

// 2. Verify OTP and Complete Signup
export async function registerVerify(req: Request, res: Response) {
  try {
    const { mobileNumber, otp } = req.body;

    if (!mobileNumber || !otp) {
      return res.status(400).json({ message: 'Mobile number and OTP are required.' });
    }

    const signupData = tempSignups[mobileNumber];
    if (!signupData) {
      return res.status(400).json({ message: 'No registration session found. Please request OTP again.' });
    }

    if (Date.now() > signupData.expiresAt) {
      delete tempSignups[mobileNumber];
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (signupData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP code. Please check and try again.' });
    }

    // Create user in Firebase Auth
    const formattedPhone = formatPhoneNumber(mobileNumber);
    let firebaseUser: any;
    try {
      firebaseUser = await auth.createUser({
        email: signupData.email,
        password: signupData.passwordHash,
        displayName: signupData.name,
        phoneNumber: formattedPhone,
      });
    } catch (fbErr: any) {
      console.error('Firebase user creation failed, checking if already exists:', fbErr);
      try {
        firebaseUser = await auth.getUserByEmail(signupData.email);
      } catch (getErr) {
        return res.status(400).json({ message: fbErr.message || 'Firebase Auth account creation failed.' });
      }
    }

    // Create user in Postgres database
    let dbUser = await prisma.user.findUnique({ where: { id: firebaseUser.uid } });
    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          id: firebaseUser.uid,
          email: signupData.email,
          mobileNumber: signupData.mobileNumber,
          name: signupData.name,
          creditsBalance: 100,
        },
      });
    }

    // Generate custom login token
    const customToken = await auth.createCustomToken(firebaseUser.uid);

    // Clean up temporary store
    delete tempSignups[mobileNumber];

    return res.status(201).json({
      message: 'Account registered and verified successfully.',
      customToken,
      user: dbUser,
    });
  } catch (err: any) {
    console.error('Error in registerVerify:', err);
    return res.status(500).json({ message: err.message || 'Error completing account verification.' });
  }
}

// 3. Request OTP for Login
export async function loginOtpRequest(req: Request, res: Response) {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required.' });
    }

    // Check if user exists with this mobile number
    const dbUser = await prisma.user.findFirst({
      where: { mobileNumber },
    });

    if (!dbUser) {
      return res.status(404).json({ message: 'Account with this mobile number does not exist. Please sign up first.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store in-memory
    tempLogins[mobileNumber] = {
      otp,
      expiresAt,
    };

    // Send SMS OTP
    const isRealSMS = await sendSMSOtp(mobileNumber, otp);

    return res.status(200).json({
      message: 'Verification OTP sent to mobile number.',
      debugOtp: !isRealSMS ? otp : undefined
    });
  } catch (err: any) {
    console.error('Error in loginOtpRequest:', err);
    return res.status(500).json({ message: err.message || 'Error requesting login OTP.' });
  }
}

// 4. Verify OTP and Complete Login
export async function loginOtpVerify(req: Request, res: Response) {
  try {
    const { mobileNumber, otp } = req.body;

    if (!mobileNumber || !otp) {
      return res.status(400).json({ message: 'Mobile number and OTP are required.' });
    }

    const loginData = tempLogins[mobileNumber];
    if (!loginData) {
      return res.status(400).json({ message: 'No active login session. Please request OTP first.' });
    }

    if (Date.now() > loginData.expiresAt) {
      delete tempLogins[mobileNumber];
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (loginData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP code.' });
    }

    // Find the user
    const dbUser = await prisma.user.findFirst({
      where: { mobileNumber },
    });

    if (!dbUser) {
      return res.status(404).json({ message: 'User record not found.' });
    }

    // Generate custom login token
    const customToken = await auth.createCustomToken(dbUser.id);

    // Clean up temporary store
    delete tempLogins[mobileNumber];

    return res.status(200).json({
      message: 'Login successful.',
      customToken,
      user: dbUser,
    });
  } catch (err: any) {
    console.error('Error in loginOtpVerify:', err);
    return res.status(500).json({ message: err.message || 'Error validating login OTP.' });
  }
}

// In-memory store for phone binding OTPs
const tempBindings: Record<string, { otp: string; expiresAt: number; mobileNumber: string }> = {};

// Request phone binding OTP (For social/Google signed up users)
export async function bindPhoneRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized. Please sign in first.' });
    }

    const { mobileNumber } = req.body;
    if (!mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required.' });
    }

    // Check if mobile number is already registered under another account
    const existingUser = await prisma.user.findFirst({
      where: {
        mobileNumber,
        NOT: { id: user.id }
      }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'This mobile number is already linked to another account.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min expiry

    tempBindings[user.id] = {
      otp,
      expiresAt,
      mobileNumber
    };

    // Send SMS
    const isRealSMS = await sendSMSOtp(mobileNumber, otp);

    return res.status(200).json({
      message: 'Verification OTP sent to mobile number.',
      debugOtp: !isRealSMS ? otp : undefined
    });
  } catch (err: any) {
    console.error('Error in bindPhoneRequest:', err);
    return res.status(500).json({ message: err.message || 'Error requesting phone binding OTP.' });
  }
}

// Verify phone binding OTP
export async function bindPhoneVerify(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized. Please sign in first.' });
    }

    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ message: 'OTP is required.' });
    }

    const bindData = tempBindings[user.id];
    if (!bindData) {
      return res.status(400).json({ message: 'No active binding session. Please request OTP first.' });
    }

    if (Date.now() > bindData.expiresAt) {
      delete tempBindings[user.id];
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (bindData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    // Link mobile number to Firebase authentication if possible, but mainly in our DB
    const formattedPhone = formatPhoneNumber(bindData.mobileNumber);
    try {
      await auth.updateUser(user.id, {
        phoneNumber: formattedPhone
      });
    } catch (fbErr: any) {
      console.warn('Could not update phone number in Firebase (might already exist or be invalid):', fbErr.message);
    }

    // Update locally in Postgres
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        mobileNumber: bindData.mobileNumber
      }
    });

    // Clean up session
    delete tempBindings[user.id];

    return res.status(200).json({
      message: 'Mobile number bound successfully.',
      user: updatedUser,
      mobileBound: true
    });
  } catch (err: any) {
    console.error('Error in bindPhoneVerify:', err);
    return res.status(500).json({ message: err.message || 'Error verifying phone number binding.' });
  }
}

// Admin login bypassing normal flow
export async function adminLogin(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (email !== 'admin@admin.com' || password !== 'Admin@0987') {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }

    // Ensure Firebase admin account exists
    let firebaseUser;
    try {
      firebaseUser = await auth.getUserByEmail(email);
    } catch (err) {
      try {
        firebaseUser = await auth.createUser({
          uid: 'admin_root',
          email: email,
          password: password,
          displayName: 'RetailStacker Admin',
        });
      } catch (createErr: any) {
        console.error('Error creating Firebase Admin user:', createErr);
        return res.status(500).json({ message: 'Failed to initialize admin credentials in auth provider.' });
      }
    }

    // Ensure user exists with ADMIN role in database
    const dbUser = await prisma.user.upsert({
      where: { id: firebaseUser.uid },
      update: { role: 'ADMIN' },
      create: {
        id: firebaseUser.uid,
        email: email,
        name: 'RetailStacker Admin',
        role: 'ADMIN',
        creditsBalance: 999999,
      }
    });

    const customToken = await auth.createCustomToken(firebaseUser.uid);

    return res.status(200).json({
      message: 'Admin login successful.',
      customToken,
      user: dbUser,
    });
  } catch (err: any) {
    console.error('Error in adminLogin:', err);
    return res.status(500).json({ message: err.message || 'Error logging in as admin.' });
  }
}

