
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import * as dotenv from 'dotenv';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

dotenv.config();

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'https://res.cloudinary.com', 'data:'],
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
    })
);

app.use(
    cors({
        origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://127.0.0.1:5500', 'http://localhost:5500'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    })
);

app.use(
    '/api/',
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        skip: (req: Request) => req.path === '/health' || req.path === '/api/health',
    })
);

// ─── Body Parsing & Logging ─────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());

// ─── Static & Request ID ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));
app.use((req: Request, res: Response, next: NextFunction) => {
    (req as any).id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    res.setHeader('X-Request-ID', (req as any).id);
    next();
});

// ─── Health Endpoints ───────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
    });
});
app.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});
app.get('/health/ready', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
});

// ─── Main API Routes ────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── Error Handling ─────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        timestamp: new Date().toISOString(),
        requestId: (req as any).id,
    });
});
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Error]', err);
    const statusCode = err.statusCode || 500;
    const message =
        NODE_ENV === 'production' && statusCode === 500
            ? 'Internal Server Error'
            : err.message;
    res.status(statusCode).json({
        error: err.name || 'Error',
        message,
        timestamp: new Date().toISOString(),
        requestId: (req as any).id,
    });
});

export default app;
