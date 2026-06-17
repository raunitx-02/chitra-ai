import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.routes';
import videoRoutes from './routes/video.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import resellerRoutes from './routes/reseller.routes';
import productRoutes from './routes/product.routes';
import { errorHandler } from './middlewares/error.middleware';
import { resumeActivePolling } from './controllers/video.controller';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://frontend-zeta-vert-25.vercel.app',
  'https://ugc.retailstacker.com',
  'http://ugc.retailstacker.com',
  'https://chitraai.retailstacker.com',
  'http://chitraai.retailstacker.com',
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static files for uploads
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reseller', resellerRoutes);
app.use('/api/product', productRoutes);

// Error Middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[RetailStacker AI Video Server] Running on localhost port ${PORT}`);
  resumeActivePolling();
});

export default app;
