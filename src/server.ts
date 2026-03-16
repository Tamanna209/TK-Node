
import * as dotenv from 'dotenv';
dotenv.config();

// Initialize Firebase BEFORE importing app (ensures Admin SDK is ready)
import './config/firebase';
import app from './app';

const PORT = parseInt(process.env.PORT || '5000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const SHUTDOWN_TIMEOUT = 30000;
const HEALTH_CHECK_INTERVAL = 30000;

let server: import('http').Server | null = null;

async function gracefulShutdown(signal: string) {
    console.log(`\n[Shutdown] ${signal} received...`);
    setTimeout(() => {
        console.error('[Shutdown] Forced exit');
        process.exit(1);
    }, SHUTDOWN_TIMEOUT);

    if (server) {
        await new Promise((resolve) => server!.close(resolve));
    }

    // Add any DB/Redis shutdown logic here if needed
    // Example: await mongoose.connection.close(false);

    console.log('[Shutdown] Completed');
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
    console.error('[Fatal]', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason) => {
    console.error('[Fatal]', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

async function startApplication() {
    try {
        console.log(`Environment: ${NODE_ENV}`);
        console.log(`Node Version: ${process.version}`);

        // Add any async DB/Redis/Cloudinary init here if needed

        // Start HTTP Server
        console.log('\n[3/3] Starting HTTP server...');
        server = app.listen(PORT, () => {
            console.log('='.repeat(70));
            console.log(`✓ Server is running on port ${PORT}`);
            console.log(`✓ API Base URL: http://localhost:${PORT}/api`);
            console.log(`✓ Health Check: http://localhost:${PORT}/health`);
            console.log('='.repeat(70));
            console.log('Press CTRL+C to stop the server\n');
        });

        setInterval(() => {
            const rssMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
            console.log(`[Health] Memory: ${rssMB}MB`);
        }, HEALTH_CHECK_INTERVAL);

    } catch (error) {
        console.error('Startup failed:', error);
        process.exit(1);
    }
}

startApplication();
