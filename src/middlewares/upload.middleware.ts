import multer from 'multer';
import { Request } from 'express';

// Allowed MIME types for file uploads
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Use memory storage — files held in buffer before uploading to Firebase Storage
const storage = multer.memoryStorage();

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    callback: multer.FileFilterCallback
) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        callback(null, true);
    } else {
        callback(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
};

// Single file upload middleware
export const uploadSingle = (fieldName: string) =>
    multer({
        storage,
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter,
    }).single(fieldName);

// Multiple files upload middleware
export const uploadMultiple = (fieldName: string, maxCount: number) =>
    multer({
        storage,
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter,
    }).array(fieldName, maxCount);
