import * as admin from 'firebase-admin';
import { db } from '../config/firebase';

const USERS_COLLECTION = 'users';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
    to: string;
    title?: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: 'default' | null;
    badge?: number;
    channelId?: string;
    priority?: 'default' | 'normal' | 'high';
    categoryId?: string;
}

interface ExpoPushTicket {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error?: string };
}

/**
 * Register an Expo push token for a user.
 * Uses arrayUnion so multiple devices per user are supported.
 */
export const registerPushToken = async (uid: string, token: string): Promise<void> => {
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
        throw new Error('Invalid Expo push token format');
    }

    await db.collection(USERS_COLLECTION).doc(uid).update({
        expoPushTokens: admin.firestore.FieldValue.arrayUnion(token),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};

/**
 * Unregister a specific Expo push token (e.g. on logout).
 */
export const unregisterPushToken = async (uid: string, token: string): Promise<void> => {
    await db.collection(USERS_COLLECTION).doc(uid).update({
        expoPushTokens: admin.firestore.FieldValue.arrayRemove(token),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};

/**
 * Get all push tokens for a list of user UIDs.
 */
export const getTokensForUsers = async (uids: string[]): Promise<string[]> => {
    if (uids.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < uids.length; i += 10) {
        chunks.push(uids.slice(i, i + 10));
    }

    const tokens: string[] = [];
    for (const chunk of chunks) {
        const docs = await Promise.all(
            chunk.map((uid) => db.collection(USERS_COLLECTION).doc(uid).get())
        );
        for (const doc of docs) {
            const data = doc.data();
            if (data?.expoPushTokens && Array.isArray(data.expoPushTokens)) {
                tokens.push(...data.expoPushTokens);
            }
        }
    }

    return tokens;
};

/**
 * Send push notifications via Expo Push API.
 * Automatically handles chunking (max 100 per request).
 */
export const sendPushNotifications = async (
    messages: ExpoPushMessage[]
): Promise<void> => {
    if (messages.length === 0) return;

    const chunks: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
        chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
        try {
            const response = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chunk),
            });

            const result = (await response.json()) as { data: ExpoPushTicket[] };

            for (const ticket of result.data) {
                if (ticket.status === 'error') {
                    console.warn('[Push] Ticket error:', ticket.message, ticket.details);
                    if (ticket.details?.error === 'DeviceNotRegistered') {
                        const failedToken = chunk.find(
                            (_, i) => result.data[i] === ticket
                        )?.to;
                        if (failedToken) {
                            void cleanupStaleToken(failedToken);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[Push] Failed to send batch:', err);
        }
    }
};

/**
 * Remove a stale token from all users who have it.
 */
async function cleanupStaleToken(token: string): Promise<void> {
    try {
        const snap = await db
            .collection(USERS_COLLECTION)
            .where('expoPushTokens', 'array-contains', token)
            .get();

        const batch = db.batch();
        for (const doc of snap.docs) {
            batch.update(doc.ref, {
                expoPushTokens: admin.firestore.FieldValue.arrayRemove(token),
            });
        }
        if (!snap.empty) await batch.commit();
    } catch (err) {
        console.error('[Push] Failed to cleanup stale token:', err);
    }
}

/**
 * Send a chat message push notification to specific users.
 * This is the main function called from chat.service.ts.
 */
export const sendChatPushNotification = async (params: {
    recipientUids: string[];
    senderName: string;
    chatId: string;
    messagePreview: string;
    messageType: string;
}): Promise<void> => {
    const { recipientUids, senderName, chatId, messagePreview, messageType } = params;

    const tokens = await getTokensForUsers(recipientUids);
    if (tokens.length === 0) return;

    let body = messagePreview;
    if (messageType === 'image') body = '📷 Photo';
    else if (messageType === 'audio') body = '🎤 Voice message';
    else if (messageType === 'document') body = '📎 Document';
    else if (messageType === 'product_card') body = '🛍️ Product';
    else if (messageType === 'order_card') body = '📦 Order';

    const messages: ExpoPushMessage[] = tokens.map((token) => ({
        to: token,
        title: senderName,
        body,
        data: { chatId, type: 'chat_message' },
        sound: 'default',
        channelId: 'chat-messages',
        priority: 'high',
        categoryId: 'chat',
    }));

    await sendPushNotifications(messages);
};
