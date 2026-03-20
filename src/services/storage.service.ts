import { bucket } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload a file buffer to Firebase Storage
 * @param fileBuffer - File buffer from multer memory storage
 * @param mimeType - MIME type of the file (e.g., 'image/jpeg')
 * @param destinationPath - Full path in storage bucket (e.g., 'users/uid/profile.jpg')
 * @returns Public download URL of the uploaded file
 */
export const uploadFile = async (
    fileBuffer: Buffer,
    mimeType: string,
    destinationPath: string
): Promise<string> => {
    const file = bucket.file(destinationPath);

    const token = uuidv4();

    await file.save(fileBuffer, {
        metadata: {
            contentType: mimeType,
            metadata: {
                firebaseStorageDownloadTokens: token,
            },
        },
        public: false,
    });

    // Make file publicly accessible
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destinationPath}`;
    return publicUrl;
};

/**
 * Delete a file from Firebase Storage
 * @param destinationPath - Full path in storage bucket
 */
export const deleteFile = async (destinationPath: string): Promise<void> => {
    try {
        const file = bucket.file(destinationPath);
        await file.delete();
    } catch (error) {
        // File may not exist, ignore error
        console.warn(`Could not delete file at ${destinationPath}:`, error);
    }
};

/**
 * Extract the storage path from a public URL
 */
export const extractStoragePath = (publicUrl: string): string | null => {
    try {
        const url = new URL(publicUrl);
        // Remove leading slash and bucket name from path
        const pathParts = url.pathname.split('/');
        // Format: /bucket-name/path/to/file => path/to/file
        return pathParts.slice(2).join('/');
    } catch {
        return null;
    }
};
