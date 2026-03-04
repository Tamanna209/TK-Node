import { Timestamp } from 'firebase-admin/firestore';

import * as admin from 'firebase-admin';

export interface Category {
    id: string;
    slug: string;
    name: string;
    createdAt: Timestamp | admin.firestore.FieldValue;
    updatedAt: Timestamp | admin.firestore.FieldValue;
}

export interface CreateCategoryDTO {
    name: string;
}

export interface UpdateCategoryDTO extends Partial<CreateCategoryDTO> {}
