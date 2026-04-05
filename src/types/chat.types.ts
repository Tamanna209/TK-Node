import { Timestamp } from 'firebase-admin/firestore';

export type MessageType = 'text' | 'image' | 'audio' | 'document' | 'product_card' | 'order_card' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
export type SenderRole = 'buyer' | 'seller' | 'admin';

export interface ParticipantInfo {
    name: string;
    avatar: string | null;
    role: SenderRole;
}

export interface LastMessage {
    text: string;
    senderId: string;
    timestamp: Timestamp;
    type: MessageType;
}

export interface ChatDocument {
    id: string;
    participants: string[];
    participantDetails: Record<string, ParticipantInfo>;
    lastMessage: LastMessage | null;
    unreadCount: Record<string, number>;
    linkedOrderId?: string;
    linkedRequestId?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface ChatMessageDocument {
    id: string;
    senderId: string;
    senderRole: SenderRole;
    type: MessageType;
    text?: string;
    imageUrl?: string;
    audioUrl?: string;
    audioDurationMs?: number;
    document?: {
        name: string;
        url: string;
        mimeType: string;
        size?: number;
    };
    product?: {
        id: string;
        name: string;
        image: string;
        price: number;
    };
    order?: {
        id: string;
        orderNumber: string;
        totalAmount: number;
        status: string;
    };
    timestamp: Timestamp;
    readBy: string[];
    status: MessageStatus;
}

export interface CreateChatDTO {
    buyerUid: string;
    sellerUid: string;
    linkedOrderId?: string;
    linkedRequestId?: string;
    /** When set, analytics records contact_clicked (and ties chat_started to this product). */
    productId?: string;
}

export interface SendMessageDTO {
    type: MessageType;
    text?: string;
    imageUrl?: string;
    audioUrl?: string;
    audioDurationMs?: number;
    document?: {
        name: string;
        url: string;
        mimeType: string;
        size?: number;
    };
    product?: {
        id: string;
        name: string;
        image: string;
        price: number;
    };
    order?: {
        id: string;
        orderNumber: string;
        totalAmount: number;
        status: string;
    };
}
