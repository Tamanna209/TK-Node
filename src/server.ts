import * as dotenv from 'dotenv';
dotenv.config();

// Initialize Firebase BEFORE importing app (ensures Admin SDK is ready)
import './config/firebase';

import app from './app';

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = app.listen(PORT, () => {
    console.log('');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│        TK App Backend Server            │');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│  🚀 Server running on port: ${PORT}        │`);
    console.log(`│  📦 Environment: ${(process.env.NODE_ENV || 'development').padEnd(22)} │`);
    console.log(`│  📡 API Base: http://localhost:${PORT}/api │`);
    console.log('└─────────────────────────────────────────┘');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

export default server;
