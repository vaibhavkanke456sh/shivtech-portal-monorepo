import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import connectDB from './config/database.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import dataRoutes, { runFullGroupPaymentRepair } from './routes/data.js';
import reportsRoutes from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize express
const app = express();

// Trust proxy for Render deployment
app.set('trust proxy', 1);

// Last startup/data repair snapshot (shown on /health for easy production checks)
let lastGroupRepair = null;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
      'https://shivtech-portal-frontend.vercel.app',
      'https://shivtech-portal-frontend-kfu227h14-vaibhavkanke456shs-projects.vercel.app',
      'https://shivtech-portal-frontend-36cu8oyrm-vaibhavkanke456shs-projects.vercel.app',
      process.env.CORS_ORIGIN
    ].filter(Boolean);

    // Check if origin matches any allowed origin
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check if origin matches Vercel deployment pattern
    if (origin.match(/^https:\/\/shivtech-portal-frontend-[a-z0-9]+-vaibhavkanke456shs-projects\.vercel\.app$/)) {
      return callback(null, true);
    }

    // Reject other origins
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting (enabled only in production)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

if ((process.env.NODE_ENV || 'development') === 'production') {
  app.use('/api/', limiter);
}

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'DSAM Portal Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    groupPaymentRepair: lastGroupRepair
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/reports', reportsRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to DSAM Portal Backend API',
    version: '1.0.1',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      health: '/health'
    }
  });
});

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Start only after Mongo is up and legacy fully-paid groups are settled
const PORT = process.env.PORT || 5000;

const boot = async () => {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await connectDB();
    console.log('⏳ Running fully-paid group payment repair...');
    try {
      const stats = await runFullGroupPaymentRepair();
      lastGroupRepair = {
        ...stats,
        ranAt: new Date().toISOString()
      };
      console.log(
        `🔧 Group payment repair: checked=${stats.groupsChecked}, repaired=${stats.groupsRepaired}, tasksUpdated=${stats.tasksUpdated}`
      );
    } catch (err) {
      lastGroupRepair = {
        error: err.message || String(err),
        ranAt: new Date().toISOString()
      };
      console.error('Startup group payment repair failed (server continues):', err.message || err);
    }

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
      console.log(`👨‍💼 Admin endpoints: http://localhost:${PORT}/api/admin`);
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Process terminated');
      });
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
};

boot();

export default app;
