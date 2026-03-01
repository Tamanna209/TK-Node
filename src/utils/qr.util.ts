import QRCode from 'qrcode';
import { uploadFile } from '../services/storage.service';
import { saveQRCodeURL } from '../services/seller.service';

/**
 * Generate a QR code PNG for a seller's profile deep link,
 * upload it to Firebase Storage, and save the URL to Firestore.
 *
 * @param sellerUid - The seller's UID
 * @returns Public URL of the QR code PNG in Firebase Storage
 */
export const generateAndSaveSellerQR = async (sellerUid: string): Promise<string> => {
    const deepLink = `${process.env.APP_DEEP_LINK_BASE || 'tkapp://sellers'}/${sellerUid}`;

    // Generate QR code as a PNG buffer
    const qrBuffer = await QRCode.toBuffer(deepLink, {
        type: 'png',
        width: 512,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF',
        },
    });

    // Upload QR code to Firebase Storage
    const storagePath = `qrcodes/sellers/${sellerUid}/qr.png`;
    const publicUrl = await uploadFile(qrBuffer, 'image/png', storagePath);

    // Save URL to seller's Firestore profile
    await saveQRCodeURL(sellerUid, publicUrl);

    return publicUrl;
};
