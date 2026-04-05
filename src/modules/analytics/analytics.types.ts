import type { Timestamp } from 'firebase-admin/firestore';
import type { AnalyticsRangePreset } from './analytics-date-range.util';

export type AnalyticsEventType =
    | 'product_viewed'
    | 'contact_clicked'
    | 'chat_started'
    | 'request_created';

export interface AppliedAnalyticsWindow {
    start: string;
    end: string;
    source: 'preset' | 'custom' | 'default';
    preset?: AnalyticsRangePreset;
}

export interface TrackEventInput {
    sellerId: string;
    productId: string;
    buyerId: string;
    eventType: AnalyticsEventType;
}

export interface ProductStatDoc {
    productId: string;
    sellerId: string;
    views: number;
    clicks: number;
    requests: number;
    chats: number;
    updatedAt: Timestamp | null;
    lastRequestAt?: Timestamp | null;
}

export interface SellerSummaryResult {
    totalProducts: number;
    activeProducts: number;
    archivedProducts: number;
    totalViews: number;
    totalRequests: number;
    totalChats: number;
    topProducts: Array<{
        productId: string;
        name: string;
        slug: string;
        requests: number;
    }>;
    insights: string[];
    appliedRange: AppliedAnalyticsWindow;
    /** @deprecated Use appliedRange.preset or appliedRange.source */
    range?: string | null;
}

export interface ProductAnalyticsRow {
    productId: string;
    name: string;
    slug: string;
    status: string;
    views: number;
    clicks: number;
    requests: number;
    chats: number;
    performanceScore: number;
}

export interface FunnelResult {
    views: number;
    clicks: number;
    chats: number;
    requests: number;
}

/** @deprecated Use DailyTrendRow — kept for older clients */
export interface TrendDay {
    date: string;
    requests: number;
}

export interface DailyTrendRow {
    date: string;
    views: number;
    requests: number;
    chats: number;
}

export interface TrendsResult {
    daily: DailyTrendRow[];
    /** Same as daily, requests only — backward compatible */
    series: TrendDay[];
    appliedRange: AppliedAnalyticsWindow;
    /** @deprecated Use appliedRange.preset */
    range?: string | null;
}

export interface InventoryAnalyticsResult {
    lowStock: Array<{
        productId: string;
        name: string;
        sku: string;
        quantity: number;
        lowStockThreshold: number;
    }>;
    outOfStock: Array<{
        productId: string;
        name: string;
        sku: string;
    }>;
    fastSelling: Array<{
        productId: string;
        name: string;
        requests: number;
    }>;
    deadStock: Array<{
        productId: string;
        name: string;
        slug: string;
    }>;
    appliedRange: AppliedAnalyticsWindow;
}

export interface MissingDemandResult {
    items: MissingDemandItem[];
    appliedRange: AppliedAnalyticsWindow;
}

export interface MissingDemandItem {
    keywords: string[];
    sampleNote?: string;
    count: number;
}

export interface RecordBuyerProductRequestInput {
    productId: string;
    keywords?: string[];
    note?: string;
}

export interface FunnelWithMeta extends FunnelResult {
    appliedRange: AppliedAnalyticsWindow;
}

export interface ProductsAnalyticsResult {
    products: ProductAnalyticsRow[];
    appliedRange: AppliedAnalyticsWindow;
}
