import { Request, Response } from 'express';
import {
    getOrCreateChat,
    getChatsForUser,
    getChatById,
    sendMessage,
    getMessages,
    markChatAsRead,
    setTypingStatus,
    getTotalUnreadCount,
} from '../services/chat.service';
import { getUserById } from '../services/user.service';
import { uploadFile } from '../services/storage.service';
import { sendSuccess, sendError } from '../utils/response.util';
import { SenderRole, SendMessageDTO } from '../types/chat.types';

/**
 * POST /api/chats
 * Create or get existing chat between authenticated user and another user (seller)
 */
export const createOrGetChatController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) { sendError(res, 'Unauthorized', 401); return; }

        const { sellerUid, linkedOrderId, linkedRequestId } = req.body as {
            sellerUid: string;
            linkedOrderId?: string;
            linkedRequestId?: string;
        };

        if (!sellerUid) {
            sendError(res, 'sellerUid is required', 400);
            return;
        }

        if (sellerUid === req.user.uid) {
            sendError(res, 'Cannot create a chat with yourself', 400);
            return;
        }

        const { chat, isNew } = await getOrCreateChat({
            buyerUid: req.user.uid,
            sellerUid,
            linkedOrderId,
            linkedRequestId,
        });

        sendSuccess(res, { chat, isNew }, isNew ? 'Chat created' : 'Existing chat found', isNew ? 201 : 200);
    } catch (error) {
        const err = error as Error;
        console.error('createOrGetChat error:', err.message);
        sendError(res, err.message || 'Failed to create chat', 500);
    }
};

/**
 * GET /api/chats
 * List all chats for authenticated user
 */
export const listMyChats = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) { sendError(res, 'Unauthorized', 401); return; }

        const chats = await getChatsForUser(req.user.uid);
        const unreadTotal = await getTotalUnreadCount(req.user.uid);

        sendSuccess(res, { chats, unreadTotal }, 'Chats fetched');
    } catch (error) {
        const err = error as Error;
        console.error('listMyChats error:', err.message);
        sendError(res, 'Failed to fetch chats', 500);
    }
};

/**
 * GET /api/chats/:chatId
 * Get a single chat with recent messages
 */
export const getChatDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) { sendError(res, 'Unauthorized', 401); return; }

        const chatId = req.params['chatId'] as string;
        const chat = await getChatById(chatId);

        if (!chat) {
            sendError(res, 'Chat not found', 404);
            return;
        }

        if (!chat.participants.includes(req.user.uid)) {
            sendError(res, 'Not a participant in this chat', 403);
            return;
        }

        const messages = await getMessages(chatId, 50);

        sendSuccess(res, { chat, messages }, 'Chat details fetched');
    } catch (error) {
        const err = error as Error;
        console.error('getChatDetails error:', err.message);
        sendError(res, 'Failed to fetch chat', 500);
    }
};

/**
 * POST /api/chats/:chatId/messages
 * Send a message in a chat
 */
export const sendMessageController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) { sendError(res, 'Unauthorized', 401); return; }

        const chatId = req.params['chatId'] as string;
        const chat = await getChatById(chatId);

        if (!chat) {
            sendError(res, 'Chat not found', 404);
            return;
        }

        if (!chat.participants.includes(req.user.uid)) {
            sendError(res, 'Not a participant in this chat', 403);
            return;
        }

        const user = await getUserById(req.user.uid);
        const senderRole: SenderRole = user?.role === 'admin' ? 'admin' : user?.role === 'seller' ? 'seller' : 'buyer';

        const dto: SendMessageDTO = {
            type: req.body.type || 'text',
            text: req.body.text,
            imageUrl: req.body.imageUrl,
            product: req.body.product,
            order: req.body.order,
        };

        if (dto.type === 'text' && !dto.text) {
            sendError(res, 'Text is required for text messages', 400);
            return;
        }

        const message = await sendMessage(chatId, req.user.uid, senderRole, dto);

        sendSuccess(res, { message }, 'Message sent', 201);
    } catch (error) {
        const err = error as Error;
        console.error('sendMessage error:', err.message);
        sendError(res, err.message || 'Failed to send message', 500);
    }
};

/**
 * POST /api/chats/:chatId/messages/image
 * Send an image message (multipart upload)
 */
export const sendImageMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) { sendError(res, 'Unauthorized', 401); return; }

        const chatId = req.params['chatId'] as string;
        const chat = await getChatById(chatId);

        if (!chat) { sendError(res, 'Chat not found', 404); return; }
        if (!chat.participants.includes(req.user.uid)) { sendError(res, 'Not a participant', 403); return; }
        if (!req.file) { sendError(res, 'No image file provided', 400); return; }

        const ext = req.file.mimetype.split('/')[1] ?? 'jpg';
        const storagePath = `chats/${chatId}/${Date.now()}.${ext}`;
        const imageUrl = await uploadFile(req.file.buffer, req.file.mimetype, storagePath);

        const user = await getUserById(req.user.uid);
        const senderRole: SenderRole = user?.role === 'admin' ? 'admin' : user?.role === 'seller' ? 'seller' : 'buyer';

        const message = await sendMessage(chatId, req.user.uid, senderRole, {
            type: 'image',
            imageUrl,
            text: req.body.caption || undefined,
        });

        sendSuccess(res, { message, imageUrl }, 'Image sent', 201);
    } catch (error) {
        const err = error as Error;
        console.error('sendImageMessage error:', err.message);
        sendError(res, 'Failed to send image', 500);
    }
};

export const sendAudioMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) { sendError(res, 'Unauthorized', 401); return; }
        const chatId = req.params['chatId'] as string;
        const chat = await getChatById(chatId);
        if (!chat) { sendError(res, 'Chat not found', 404); return; }
        if (!chat.participants.includes(req.user.uid)) { sendError(res, 'Not a participant', 403); return; }
        if (!req.file) { sendError(res, 'No audio file provided', 400); return; }

        const ext = req.file.mimetype.split('/')[1] ?? 'm4a';
        const storagePath = `chats/${chatId}/${Date.now()}.${ext}`;
        const audioUrl = await uploadFile(req.file.buffer, req.file.mimetype, storagePath);

        const user = await getUserById(req.user.uid);
        const senderRole: SenderRole = user?.role === 'admin' ? 'admin' : user?.role === 'seller' ? 'seller' : 'buyer';

        const durationMs = req.body.durationMs ? Number(req.body.durationMs) : undefined;
        const message = await sendMessage(chatId, req.user.uid, senderRole, {
            type: 'audio',
            audioUrl,
            audioDurationMs: durationMs,
            text: '🎤 Voice message',
        });
        sendSuccess(res, { message, audioUrl }, 'Audio sent', 201);
    } catch (error) {
        const err = error as Error;
        console.error('sendAudioMessage error:', err.message);
        sendError(res, 'Failed to send audio', 500);
    }
};

export const sendDocumentMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) { sendError(res, 'Unauthorized', 401); return; }
        const chatId = req.params['chatId'] as string;
        const chat = await getChatById(chatId);
        if (!chat) { sendError(res, 'Chat not found', 404); return; }
        if (!chat.participants.includes(req.user.uid)) { sendError(res, 'Not a participant', 403); return; }
        if (!req.file) { sendError(res, 'No document file provided', 400); return; }

        const ext = req.file.originalname.split('.').pop() || 'bin';
        const storagePath = `chats/${chatId}/${Date.now()}-${req.file.originalname || 'document.' + ext}`;
        const fileUrl = await uploadFile(req.file.buffer, req.file.mimetype, storagePath);

        const user = await getUserById(req.user.uid);
        const senderRole: SenderRole = user?.role === 'admin' ? 'admin' : user?.role === 'seller' ? 'seller' : 'buyer';
        const message = await sendMessage(chatId, req.user.uid, senderRole, {
            type: 'document',
            document: {
                name: req.file.originalname,
                url: fileUrl,
                mimeType: req.file.mimetype,
                size: req.file.size,
            },
            text: `📎 ${req.file.originalname}`,
        });

        sendSuccess(res, { message, fileUrl }, 'Document sent', 201);
    } catch (error) {
        const err = error as Error;
        console.error('sendDocumentMessage error:', err.message);
        sendError(res, 'Failed to send document', 500);
    }
};

/**
 * GET /api/chats/:chatId/messages
 * Get paginated messages for a chat
 */
export const listMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) { sendError(res, 'Unauthorized', 401); return; }

        const chatId = req.params['chatId'] as string;
        const chat = await getChatById(chatId);

        if (!chat) { sendError(res, 'Chat not found', 404); return; }
        if (!chat.participants.includes(req.user.uid)) { sendError(res, 'Not a participant', 403); return; }

        const limit = parseInt(req.query['limit'] as string) || 50;
        const messages = await getMessages(chatId, limit);

        sendSuccess(res, { messages }, 'Messages fetched');
    } catch (error) {
        const err = error as Error;
        console.error('listMessages error:', err.message);
        sendError(res, 'Failed to fetch messages', 500);
    }
};

/**
 * POST /api/chats/:chatId/read
 * Mark all messages as read for the authenticated user
 */
export const markAsReadController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) { sendError(res, 'Unauthorized', 401); return; }

        const chatId = req.params['chatId'] as string;
        const chat = await getChatById(chatId);

        if (!chat) { sendError(res, 'Chat not found', 404); return; }
        if (!chat.participants.includes(req.user.uid)) { sendError(res, 'Not a participant', 403); return; }

        await markChatAsRead(chatId, req.user.uid);

        sendSuccess(res, null, 'Messages marked as read');
    } catch (error) {
        const err = error as Error;
        console.error('markAsRead error:', err.message);
        sendError(res, 'Failed to mark as read', 500);
    }
};

/**
 * POST /api/chats/:chatId/typing
 * Update typing indicator
 */
export const typingIndicator = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) { sendError(res, 'Unauthorized', 401); return; }

        const chatId = req.params['chatId'] as string;
        const { isTyping } = req.body as { isTyping: boolean };

        await setTypingStatus(chatId, req.user.uid, isTyping ?? false);

        sendSuccess(res, null, isTyping ? 'Typing started' : 'Typing stopped');
    } catch (error) {
        const err = error as Error;
        console.error('typingIndicator error:', err.message);
        sendError(res, 'Failed to update typing status', 500);
    }
};
