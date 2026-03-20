import { Request } from 'express';

declare global {
    namespace Express {
        interface Request {
            user?: {
                uid: string;
                phoneNumber: string;
                email?: string;
            };
        }
    }
}

export {};