import * as admin from 'firebase-admin';
import { db } from '../config/firebase';
import { getUserById } from './user.service';
import { sendChatPushNotification } from './push.service';
import {
    ChatDocument,
    ChatMessageDocument,
    CreateChatDTO,
    SendMessageDTO,
    SenderRole,
} from '../types/chat.types';

const CHATS_COLLECTION = 'chats';
const MESSAGES_SUBCOLLECTION = 'messages';

/**
 * Find an existing chat between two users, or return null
 */
export const findChatBetween = async (
    uid1: string,
    uid2: string
): Promise<ChatDocument | null> => {
    const snapshot = await db
        .collection(CHATS_COLLECTION)
        .where('participants', 'array-contains', uid1)
        .get();

    for (const doc of snapshot.docs) {
        const data = doc.data();
        if ((data.participants as string[]).includes(uid2)) {
            return { id: doc.id, ...data } as ChatDocument;
        }
    }
    return null;
};

/**
 * Create a new chat between buyer and seller.
 * Fetches user profiles to populate participantDetails.
 */
export const createChat = async (dto: CreateChatDTO): Promise<ChatDocument> => {
    const { buyerUid, sellerUid, linkedOrderId, linkedRequestId } = dto;

    const [buyer, seller] = await Promise.all([
        getUserById(buyerUid),
        getUserById(sellerUid),
    ]);

    if (!buyer) throw new Error('Buyer not found');
    if (!seller) throw new Error('Seller not found');

    const now = admin.firestore.FieldValue.serverTimestamp();

    const chatData: Record<string, unknown> = {
        participants: [buyerUid, sellerUid],
        participantDetails: {
            [buyerUid]: {
                name: buyer.name || 'Buyer',
                avatar: buyer.photoURL,
                role: 'buyer',
            },
            [sellerUid]: {
                name: seller.name || 'Seller',
                avatar: seller.photoURL,
                role: seller.role === 'admin' ? 'admin' : 'seller',
            },
        },
        lastMessage: null,
        unreadCount: {
            [buyerUid]: 0,
            [sellerUid]: 0,
        },
        createdAt: now,
        updatedAt: now,
    };

    if (linkedOrderId) chatData.linkedOrderId = linkedOrderId;
    if (linkedRequestId) chatData.linkedRequestId = linkedRequestId;

    const ref = await db.collection(CHATS_COLLECTION).add(chatData);
    const created = await ref.get();
    return { id: ref.id, ...created.data() } as ChatDocument;
};

/**
 * Get or create a chat between buyer and seller.
 * Reuses existing chat if one already exists.
 */
export const getOrCreateChat = async (dto: CreateChatDTO): Promise<{ chat: ChatDocument; isNew: boolean }> => {
    const existing = await findChatBetween(dto.buyerUid, dto.sellerUid);
    if (existing) return { chat: existing, isNew: false };

    const chat = await createChat(dto);
    return { chat, isNew: true };
};

/**
 * Get all chats for a user, ordered by last activity
 */
export const getChatsForUser = async (uid: string): Promise<ChatDocument[]> => {
    const snapshot = await db
        .collection(CHATS_COLLECTION)
        .where('participants', 'array-contains', uid)
        .orderBy('updatedAt', 'desc')
        .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChatDocument));
};

/**
 * Get a single chat by ID
 */
export const getChatById = async (chatId: string): Promise<ChatDocument | null> => {
    const doc = await db.collection(CHATS_COLLECTION).doc(chatId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as ChatDocument;
};

/**
 * Send a message in a chat.
 * Updates lastMessage, unreadCount, and updatedAt on the chat doc.
 */
export const sendMessage = async (
    chatId: string,
    senderUid: string,
    senderRole: SenderRole,
    dto: SendMessageDTO
): Promise<ChatMessageDocument> => {
    const chatRef = db.collection(CHATS_COLLECTION).doc(chatId);
    const chat = await chatRef.get();

    if (!chat.exists) throw new Error('Chat not found');

    const chatData = chat.data()!;
    const participants = chatData.participants as string[];

    if (!participants.includes(senderUid)) {
        throw new Error('User is not a participant in this chat');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    const messageData: Record<string, unknown> = {
        senderId: senderUid,
        senderRole,
        type: dto.type,
        timestamp: now,
        readBy: [senderUid],
        status: 'sent',
    };

    if (dto.text) messageData.text = dto.text;
    if (dto.imageUrl) messageData.imageUrl = dto.imageUrl;
    if (dto.audioUrl) messageData.audioUrl = dto.audioUrl;
    if (dto.audioDurationMs != null) messageData.audioDurationMs = dto.audioDurationMs;
    if (dto.document) messageData.document = dto.document;
    if (dto.product) messageData.product = dto.product;
    if (dto.order) messageData.order = dto.order;

    const msgRef = await chatRef.collection(MESSAGES_SUBCOLLECTION).add(messageData);

    const previewText =
        dto.text ||
        (dto.type === 'image' ? '📷 Photo' : '') ||
        (dto.type === 'audio' ? '🎤 Voice message' : '') ||
        (dto.type === 'document' ? `📎 ${dto.document?.name || 'Document'}` : '') ||
        (dto.type === 'product_card' ? `📦 ${dto.product?.name}` : '') ||
        (dto.type === 'order_card' ? `📋 Order ${dto.order?.orderNumber}` : '') ||
        'New message';

    const unreadUpdate: Record<string, unknown> = {};
    for (const p of participants) {
        if (p !== senderUid) {
            unreadUpdate[`unreadCount.${p}`] = admin.firestore.FieldValue.increment(1);
        }
    }

    await chatRef.update({
        lastMessage: {
            text: previewText,
            senderId: senderUid,
            timestamp: now,
            type: dto.type,
        },
        ...unreadUpdate,
        updatedAt: now,
    });

    const recipientUids = participants.filter((p) => p !== senderUid);
    const sender = await getUserById(senderUid);
    const senderName = sender?.name || 'Someone';

    void sendChatPushNotification({
        recipientUids,
        senderName,
        chatId,
        messagePreview: previewText,
        messageType: dto.type,
    });

    const created = await msgRef.get();
    return { id: msgRef.id, ...created.data() } as ChatMessageDocument;
};

/**
 * Get messages for a chat (paginated, newest last)
 */
export const getMessages = async (
    chatId: string,
    limit = 50,
    beforeTimestamp?: admin.firestore.Timestamp
): Promise<ChatMessageDocument[]> => {
    let query = db
        .collection(CHATS_COLLECTION)
        .doc(chatId)
        .collection(MESSAGES_SUBCOLLECTION)
        .orderBy('timestamp', 'desc')
        .limit(limit);

    if (beforeTimestamp) {
        query = query.startAfter(beforeTimestamp);
    }

    const snapshot = await query.get();
    const messages = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as ChatMessageDocument)
    );

    return messages.reverse();
};

/**
 * Mark all messages in a chat as read for a specific user.
 * Resets their unreadCount to 0 and adds uid to readBy on recent messages.
 */
export const markChatAsRead = async (chatId: string, uid: string): Promise<void> => {
    const chatRef = db.collection(CHATS_COLLECTION).doc(chatId);

    await chatRef.update({
        [`unreadCount.${uid}`]: 0,
    });

    // Fetch recent messages not sent by this user (those are the ones to mark read)
    const recentMessages = await chatRef
        .collection(MESSAGES_SUBCOLLECTION)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

    const batch = db.batch();
    let count = 0;

    for (const msgDoc of recentMessages.docs) {
        const data = msgDoc.data();
        const readBy = (data.readBy as string[]) || [];
        if (!readBy.includes(uid) && data.senderId !== uid) {
            batch.update(msgDoc.ref, {
                readBy: admin.firestore.FieldValue.arrayUnion(uid),
                status: 'read',
            });
            count++;
            if (count >= 450) break;
        }
    }

    if (count > 0) await batch.commit();
};

/**
 * Update typing status for a user in a chat
 */
export const setTypingStatus = async (
    chatId: string,
    uid: string,
    isTyping: boolean
): Promise<void> => {
    const chatRef = db.collection(CHATS_COLLECTION).doc(chatId);

    if (isTyping) {
        await chatRef.update({
            [`typingUsers.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
        });
    } else {
        await chatRef.update({
            [`typingUsers.${uid}`]: admin.firestore.FieldValue.delete(),
        });
    }
};

/**
 * Get total unread count across all chats for a user
 */
export const getTotalUnreadCount = async (uid: string): Promise<number> => {
    const chats = await getChatsForUser(uid);
    return chats.reduce((sum, chat) => sum + (chat.unreadCount[uid] || 0), 0);
};
