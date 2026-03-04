import * as admin from 'firebase-admin';
import { db } from '../config/firebase';
import { Category, CreateCategoryDTO, UpdateCategoryDTO } from '../types/category.types';
import { generateSlug } from '../utils/slug.util';

const CATEGORIES_COLLECTION = 'categories';

export const listCategories = async (): Promise<Category[]> => {
    const snapshot = await db.collection(CATEGORIES_COLLECTION).orderBy('name').get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
};

export const createCategory = async (data: CreateCategoryDTO): Promise<Category> => {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const slug = generateSlug(data.name);
    const docRef = await db.collection(CATEGORIES_COLLECTION).add({
        name: data.name,
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
