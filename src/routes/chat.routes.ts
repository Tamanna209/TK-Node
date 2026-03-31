import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { uploadSingle, uploadChatSingle } from '../middlewares/upload.middleware';
import {
    createOrGetChatController,
    listMyChats,
    getChatDetails,
    sendMessageController,
    sendImageMessage,
    sendAudioMessage,
    sendDocumentMessage,
    listMessages,
    markAsReadController,
    typingIndicator,
} from '../controllers/chat.controller';

const router = Router();

/** POST /api/chats — Create or get existing chat with a seller */
router.post('/', authenticate, createOrGetChatController);

/** GET /api/chats — List all my chats */
router.get('/', authenticate, listMyChats);

/** GET /api/chats/:chatId — Get chat details with recent messages */
router.get('/:chatId', authenticate, getChatDetails);

/** POST /api/chats/:chatId/messages — Send a text/product/order message */
router.post('/:chatId/messages', authenticate, sendMessageController);

/** POST /api/chats/:chatId/messages/image — Send an image message */
router.post('/:chatId/messages/image', authenticate, uploadSingle('image'), sendImageMessage);
router.post('/:chatId/messages/audio', authenticate, uploadChatSingle('audio'), sendAudioMessage);
router.post('/:chatId/messages/document', authenticate, uploadChatSingle('document'), sendDocumentMessage);

/** GET /api/chats/:chatId/messages — Get paginated messages */
router.get('/:chatId/messages', authenticate, listMessages);

/** POST /api/chats/:chatId/read — Mark chat as read */
router.post('/:chatId/read', authenticate, markAsReadController);

/** POST /api/chats/:chatId/typing — Typing indicator */
router.post('/:chatId/typing', authenticate, typingIndicator);

export default router;
