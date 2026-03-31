import * as admin from 'firebase-admin';
import { db } from '../config/firebase';
import { Category, CreateCategoryDTO, UpdateCategoryDTO } from '../types/category.types';
import { generateSlug } from '../utils/slug.util';

const CATEGORIES_COLLECTION = 'categories';

export const listCategories = async (): Promise<Category[]> => {
    const snapshot = await db.collection(CATEGORIES_COLLECTION).orderBy('name').get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
};

export const searchCategories = async (query: string, limit = 20): Promise<Category[]> => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    // Prefix search on normalized field for fast suggestions.
    const snapshot = await db
        .collection(CATEGORIES_COLLECTION)
        .orderBy('nameLower')
        .startAt(q)
        .endAt(`${q}\uf8ff`)
        .limit(limit)
        .get();

    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
};

export const createCategory = async (data: CreateCategoryDTO): Promise<Category> => {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const trimmedName = data.name.trim();
    const slug = generateSlug(trimmedName);
    const nameLower = trimmedName.toLowerCase();

    // Prevent duplicates by exact lowercase name.
    const existing = await db
        .collection(CATEGORIES_COLLECTION)
        .where('nameLower', '==', nameLower)
        .limit(1)
        .get();
    if (!existing.empty) {
        const doc = existing.docs[0];
        return { id: doc.id, ...doc.data() } as Category;
    }

    const docRef = await db.collection(CATEGORIES_COLLECTION).add({
        name: trimmedName,
        nameLower,
        slug,
        createdAt: now,
        updatedAt: now,
    });
    const snap = await docRef.get();
    return { id: docRef.id, ...snap.data() } as Category;
};

export const updateCategory = async (
    id: string,
    data: UpdateCategoryDTO
): Promise<Category> => {
    const docRef = db.collection(CATEGORIES_COLLECTION).doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
        throw new Error('Category not found');
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const updateData: any = { ...data, updatedAt: now };
    if (data.name && data.name !== (existing.data() as Category).name) {
        updateData.slug = generateSlug(data.name);
        updateData.nameLower = data.name.trim().toLowerCase();
    }
    await docRef.update(updateData);
    const snap = await docRef.get();
    return { id: snap.id, ...snap.data() } as Category;
};

export const deleteCategory = async (id: string): Promise<void> => {
    const docRef = db.collection(CATEGORIES_COLLECTION).doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
        throw new Error('Category not found');
    }
    await docRef.delete();
};

/**
 * Get a category by its slug (public use)
 */
export const getCategoryBySlug = async (slug: string): Promise<Category | null> => {
    const snapshot = await db
        .collection(CATEGORIES_COLLECTION)
        .where('slug', '==', slug)
        .limit(1)
        .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Category;
};
