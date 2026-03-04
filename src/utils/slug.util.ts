import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a URL-friendly slug from a string and append a short random suffix
 * to ensure uniqueness.
 * Example: "My Cool Product" -> "my-cool-product-1a2b"
 */
export const generateSlug = (text: string): string => {
    const base = text
        .toString()
        .toLowerCase()
        // remove accents
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        // replace non-word chars with hyphen
        .replace(/[^a-z0-9]+/g, '-')
        // trim hyphens
        .replace(/^-+|-+$/g, '');

    const suffix = uuidv4().split('-')[0]; // 8 chars
    return `${base}-${suffix}`;
};
