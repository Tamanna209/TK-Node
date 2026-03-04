export interface ApiResponse<T = undefined> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
}

export interface PaginationQuery {
    page?: number;
    limit?: number;
    lastDocId?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total?: number;
    hasMore: boolean;
    lastDocId?: string;
}

export interface AuthenticatedRequest {
    uid: string;
    phoneNumber: string;
    email?: string;
}
