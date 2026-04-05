import * as admin from 'firebase-admin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { db } from '../../config/firebase';
import { listProductsBySeller, getProductById } from '../../services/product.service';
import type { Product } from '../../types/product.types';
import type { AnalyticsDateRange } from './analytics-date-range.util';
import { previousPeriodRange } from './analytics-date-range.util';
import type {
    AnalyticsEventType,
    AppliedAnalyticsWindow,
    DailyTrendRow,
    FunnelResult,
    FunnelWithMeta,
    InventoryAnalyticsResult,
    MissingDemandItem,
    MissingDemandResult,
    ProductAnalyticsRow,
    ProductsAnalyticsResult,
    RecordBuyerProductRequestInput,
    SellerSummaryResult,
    TrackEventInput,
    TrendsResult,
} from './analytics.types';

const ANALYTICS_EVENTS = 'analytics_events';
const PRODUCT_STATS = 'product_stats';
const BUYER_PRODUCT_REQUESTS = 'buyer_product_requests';

const MS_DAY = 24 * 60 * 60 * 1000;

const STAT_FIELDS: Record<
    AnalyticsEventType,
    Partial<{ views: number; clicks: number; requests: number; chats: number }>
> = {
    product_viewed: { views: 1 },
    contact_clicked: { clicks: 1 },
    chat_started: { chats: 1 },
    request_created: { requests: 1 },
};

function appliedWindow(dr: AnalyticsDateRange, start: Date, end: Date): AppliedAnalyticsWindow {
    return {
        start: start.toISOString(),
        end: end.toISOString(),
        source: dr.source,
        preset: dr.presetKey,
    };
}

function startOfDayUtc(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toDate(v: unknown): Date | null {
    if (!v) return null;
    const any = v as { toDate?: () => Date; seconds?: number };
    if (typeof any.toDate === 'function') return any.toDate();
    if (typeof any.seconds === 'number') return new Date(any.seconds * 1000);
    if (v instanceof Date) return v;
    return null;
}

/**
 * Firestore: sellerId + timestamp closed interval [start, end] (inclusive).
 */
export async function loadSellerEventsInClosedRange(
    sellerId: string,
    start: Date,
    end: Date
): Promise<QueryDocumentSnapshot[]> {
    const startTs = admin.firestore.Timestamp.fromDate(start);
    const endTs = admin.firestore.Timestamp.fromDate(end);
    const snap = await db
        .collection(ANALYTICS_EVENTS)
        .where('sellerId', '==', sellerId)
        .where('timestamp', '>=', startTs)
        .where('timestamp', '<=', endTs)
        .get();
    return snap.docs;
}

/**
 * Persist raw event + atomically bump aggregated product_stats (when productId is set).
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
    const { sellerId, productId, buyerId, eventType } = input;

    const batch = db.batch();
    const eventRef = db.collection(ANALYTICS_EVENTS).doc();

    batch.set(eventRef, {
        sellerId,
        productId: productId || '',
        buyerId,
        eventType,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (productId) {
        const statRef = db.collection(PRODUCT_STATS).doc(productId);
        const inc = STAT_FIELDS[eventType];
        const patch: Record<string, unknown> = {
            productId,
            sellerId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (inc.views) patch.views = admin.firestore.FieldValue.increment(inc.views);
        if (inc.clicks) patch.clicks = admin.firestore.FieldValue.increment(inc.clicks);
        if (inc.requests) patch.requests = admin.firestore.FieldValue.increment(inc.requests);
        if (inc.chats) patch.chats = admin.firestore.FieldValue.increment(inc.chats);
        if (eventType === 'request_created') {
            patch.lastRequestAt = admin.firestore.FieldValue.serverTimestamp();
        }
        batch.set(statRef, patch, { merge: true });
    }

    await batch.commit();
}

function performanceScore(views: number, requests: number, chats: number): number {
    return views * 0.3 + requests * 0.5 + chats * 0.2;
}

function aggregateFunnelFromDocs(docs: QueryDocumentSnapshot[]): FunnelResult {
    const out = { views: 0, clicks: 0, chats: 0, requests: 0 };
    for (const d of docs) {
        const t = d.data().eventType as AnalyticsEventType;
        if (t === 'product_viewed') out.views += 1;
        else if (t === 'contact_clicked') out.clicks += 1;
        else if (t === 'chat_started') out.chats += 1;
        else if (t === 'request_created') out.requests += 1;
    }
    return out;
}

function topProductIdsByRequestsInDocs(
    docs: QueryDocumentSnapshot[],
    limit: number
): { productId: string; requests: number }[] {
    const counts = new Map<string, number>();
    for (const d of docs) {
        const row = d.data();
        if (row.eventType !== 'request_created') continue;
        const pid = row.productId as string;
        if (!pid) continue;
        counts.set(pid, (counts.get(pid) || 0) + 1);
    }
    return [...counts.entries()]
        .map(([productId, requests]) => ({ productId, requests }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, limit);
}

function eachUtcDayKeyInclusive(rangeStart: Date, rangeEnd: Date): string[] {
    const keys: string[] = [];
    let cur = startOfDayUtc(rangeStart);
    const last = startOfDayUtc(rangeEnd);
    for (let t = cur.getTime(); t <= last.getTime(); t += MS_DAY) {
        keys.push(new Date(t).toISOString().slice(0, 10));
    }
    return keys;
}

function dailyMultiTrend(
    docs: QueryDocumentSnapshot[],
    rangeStart: Date,
    rangeEnd: Date
): DailyTrendRow[] {
    const keys = eachUtcDayKeyInclusive(rangeStart, rangeEnd);
    const map = new Map<string, { views: number; requests: number; chats: number }>();
    for (const k of keys) map.set(k, { views: 0, requests: 0, chats: 0 });

    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();

    for (const d of docs) {
        const row = d.data();
        const dt = toDate(row.timestamp);
        if (!dt || dt.getTime() < startMs || dt.getTime() > endMs) continue;
        const key = startOfDayUtc(dt).toISOString().slice(0, 10);
        const cell = map.get(key);
        if (!cell) continue;
        const t = row.eventType as AnalyticsEventType;
        if (t === 'product_viewed') cell.views += 1;
        else if (t === 'request_created') cell.requests += 1;
        else if (t === 'chat_started') cell.chats += 1;
    }

    return keys.map((date) => {
        const c = map.get(date)!;
        return { date, views: c.views, requests: c.requests, chats: c.chats };
    });
}

function aggregatePerProductInRange(
    docs: QueryDocumentSnapshot[],
    sellerProductIds: Set<string>
): Map<string, { views: number; clicks: number; requests: number; chats: number }> {
    const m = new Map<string, { views: number; clicks: number; requests: number; chats: number }>();
    for (const id of sellerProductIds) {
        m.set(id, { views: 0, clicks: 0, requests: 0, chats: 0 });
    }
    for (const d of docs) {
        const row = d.data();
        const pid = row.productId as string;
        if (!pid || !sellerProductIds.has(pid)) continue;
        const t = row.eventType as AnalyticsEventType;
        const cur = m.get(pid)!;
        if (t === 'product_viewed') cur.views += 1;
        else if (t === 'contact_clicked') cur.clicks += 1;
        else if (t === 'request_created') cur.requests += 1;
        else if (t === 'chat_started') cur.chats += 1;
    }
    return m;
}

function pctChange(prev: number, cur: number): number | null {
    if (prev <= 0) return cur > 0 ? 100 : null;
    return Math.round(((cur - prev) / prev) * 1000) / 10;
}

function buildComparisonInsights(
    cur: FunnelResult,
    prev: FunnelResult,
    topProductName?: string
): string[] {
    const lines: string[] = [];

    if (prev.requests === 0 && cur.requests > 0) {
        lines.push('Requests grew from zero compared to the previous period');
    } else {
        const rPct = pctChange(prev.requests, cur.requests);
        if (rPct != null && rPct !== 0) {
            lines.push(
                rPct > 0
                    ? `Requests increased by ${rPct}% compared to the previous period`
                    : `Requests decreased by ${Math.abs(rPct)}% compared to the previous period`
            );
        }
    }

    const vPct = pctChange(prev.views, cur.views);
    if (vPct != null && Math.abs(vPct) >= 15) {
        lines.push(
            vPct > 0
                ? `Product views up ${vPct}% vs the previous period`
                : `Product views down ${Math.abs(vPct)}% vs the previous period`
        );
    }

    if (topProductName) {
        lines.push(`Top product in this window by requests: ${topProductName}`);
    }

    if (cur.views > 0 && cur.requests > 0 && cur.requests / cur.views < 0.05) {
        lines.push('Room to improve conversion from views to requests in this period');
    }
    if (cur.chats > cur.requests * 2 && cur.chats > 3) {
        lines.push('Many new chats — follow up to turn them into firm requests');
    }

    if (lines.length === 0) {
        lines.push(
            `Period summary: ${cur.views} views, ${cur.requests} requests, ${cur.chats} chats started`
        );
    }

    return lines;
}

export async function getSellerSummary(
    sellerUid: string,
    dr: AnalyticsDateRange
): Promise<SellerSummaryResult> {
    const { start, end } = dr;
    const products = await listProductsBySeller(sellerUid);
    const totalProducts = products.length;
    const activeProducts = products.filter((p) => p.status === 'active').length;
    const archivedProducts = products.filter((p) => p.status === 'archived').length;

    const productById = new Map(products.map((p) => [p.id, p]));

    const docs = await loadSellerEventsInClosedRange(sellerUid, start, end);
    const funnel = aggregateFunnelFromDocs(docs);
    const topSlice = topProductIdsByRequestsInDocs(docs, 5);

    const { prevStart, prevEnd } = previousPeriodRange(start, end);
    let prevFunnel: FunnelResult = { views: 0, clicks: 0, chats: 0, requests: 0 };
    try {
        const prevDocs = await loadSellerEventsInClosedRange(sellerUid, prevStart, prevEnd);
        prevFunnel = aggregateFunnelFromDocs(prevDocs);
    } catch {
        /* ignore comparison if query fails */
    }

    const topName = topSlice[0] ? productById.get(topSlice[0].productId)?.name : undefined;
    const insights = buildComparisonInsights(funnel, prevFunnel, topName);

    const topProducts = topSlice.map((t) => {
        const p = productById.get(t.productId);
        return {
            productId: t.productId,
            name: p?.name || 'Unknown',
            slug: p?.slug || '',
            requests: t.requests,
        };
    });

    return {
        totalProducts,
        activeProducts,
        archivedProducts,
        totalViews: funnel.views,
        totalRequests: funnel.requests,
        totalChats: funnel.chats,
        topProducts,
        insights,
        appliedRange: appliedWindow(dr, start, end),
        range: dr.presetKey ?? (dr.source === 'custom' ? 'custom' : '7d'),
    };
}

export async function getSellerProductAnalytics(
    sellerUid: string,
    dr: AnalyticsDateRange
): Promise<ProductsAnalyticsResult> {
    const { start, end } = dr;
    const products = await listProductsBySeller(sellerUid);
    const idSet = new Set(products.map((p) => p.id));
    const docs = await loadSellerEventsInClosedRange(sellerUid, start, end);
    const agg = aggregatePerProductInRange(docs, idSet);

    const rows: ProductAnalyticsRow[] = products.map((p) => {
        const s = agg.get(p.id)!;
        return {
            productId: p.id,
            name: p.name,
            slug: p.slug,
            status: p.status,
            views: s.views,
            clicks: s.clicks,
            requests: s.requests,
            chats: s.chats,
            performanceScore: Math.round(performanceScore(s.views, s.requests, s.chats) * 100) / 100,
        };
    });

    return {
        products: rows,
        appliedRange: appliedWindow(dr, start, end),
    };
}

export async function getSellerFunnel(sellerUid: string, dr: AnalyticsDateRange): Promise<FunnelWithMeta> {
    const { start, end } = dr;
    const docs = await loadSellerEventsInClosedRange(sellerUid, start, end);
    const funnel = aggregateFunnelFromDocs(docs);
    return {
        ...funnel,
        appliedRange: appliedWindow(dr, start, end),
    };
}

export async function getSellerTrends(sellerUid: string, dr: AnalyticsDateRange): Promise<TrendsResult> {
    const { start, end } = dr;
    const docs = await loadSellerEventsInClosedRange(sellerUid, start, end);
    const daily = dailyMultiTrend(docs, start, end);
    const series = daily.map(({ date, requests }) => ({ date, requests }));
    return {
        daily,
        series,
        appliedRange: appliedWindow(dr, start, end),
        range: dr.presetKey ?? (dr.source === 'custom' ? 'custom' : '7d'),
    };
}

export async function getSellerInventoryAnalytics(
    sellerUid: string,
    dr: AnalyticsDateRange
): Promise<InventoryAnalyticsResult> {
    const { start, end } = dr;
    const products = await listProductsBySeller(sellerUid);
    const docs = await loadSellerEventsInClosedRange(sellerUid, start, end);

    const requestCountsByProduct = new Map<string, number>();
    for (const d of docs) {
        const row = d.data();
        if (row.eventType !== 'request_created') continue;
        const pid = row.productId as string;
        if (!pid) continue;
        requestCountsByProduct.set(pid, (requestCountsByProduct.get(pid) || 0) + 1);
    }

    const requestCounts = products.map((p) => ({
        productId: p.id,
        name: p.name,
        requests: requestCountsByProduct.get(p.id) || 0,
    }));
    const sortedReq = [...requestCounts].sort((a, b) => b.requests - a.requests);
    const threshold = sortedReq.length
        ? Math.max(1, sortedReq[Math.floor(sortedReq.length * 0.25)]?.requests || 0)
        : 1;

    const lowStock: InventoryAnalyticsResult['lowStock'] = [];
    const outOfStock: InventoryAnalyticsResult['outOfStock'] = [];
    const deadStock: InventoryAnalyticsResult['deadStock'] = [];

    for (const p of products) {
        if (p.status !== 'active') continue;

        for (const v of p.variants || []) {
            if (v.isActive === false) continue;
            const qty = v.inventory?.quantity ?? 0;
            const th = v.inventory?.lowStockThreshold ?? 5;
            if (qty === 0) {
                outOfStock.push({ productId: p.id, name: p.name, sku: v.sku });
            } else if (qty <= th) {
                lowStock.push({
                    productId: p.id,
                    name: p.name,
                    sku: v.sku,
                    quantity: qty,
                    lowStockThreshold: th,
                });
            }
        }

        const reqsInWindow = requestCountsByProduct.get(p.id) || 0;
        if (reqsInWindow === 0) {
            deadStock.push({ productId: p.id, name: p.name, slug: p.slug });
        }
    }

    const fastSelling = sortedReq
        .filter((x) => x.requests > 0 && x.requests >= threshold)
        .slice(0, 15);

    return {
        lowStock,
        outOfStock,
        fastSelling,
        deadStock,
        appliedRange: appliedWindow(dr, start, end),
    };
}

function normalizeTerms(keywords: string[], note?: string): string[] {
    const terms = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
    if (note) {
        for (const w of note.toLowerCase().split(/\s+/)) {
            if (w.length > 2) terms.push(w);
        }
    }
    return [...new Set(terms)];
}

function sellerMatchesTerms(products: Product[], terms: string[]): boolean {
    if (terms.length === 0) return true;
    for (const p of products) {
        const hay = `${p.name} ${p.title} ${(p.searchKeywords || []).join(' ')}`.toLowerCase();
        if (terms.some((t) => hay.includes(t))) return true;
    }
    return false;
}

export async function recordBuyerProductRequest(
    buyerUid: string,
    input: RecordBuyerProductRequestInput
): Promise<void> {
    const product = await getProductById(input.productId);
    if (!product) throw new Error('Product not found');
    if (product.sellerUid === buyerUid) throw new Error('Cannot create a request for your own product');

    const sellerUid = product.sellerUid;
    const sellerProducts = await listProductsBySeller(sellerUid);
    const keywords = input.keywords || [];
    const terms = normalizeTerms(keywords, input.note);
    const matched = sellerMatchesTerms(sellerProducts, terms);

    await db.collection(BUYER_PRODUCT_REQUESTS).add({
        buyerId: buyerUid,
        sellerId: sellerUid,
        productId: input.productId,
        keywords,
        note: input.note || null,
        matched,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await trackEvent({
        sellerId: sellerUid,
        productId: input.productId,
        buyerId: buyerUid,
        eventType: 'request_created',
    });
}

export async function getMissingDemand(
    sellerUid: string,
    dr: AnalyticsDateRange
): Promise<MissingDemandResult> {
    const { start, end } = dr;
    const startTs = admin.firestore.Timestamp.fromDate(start);
    const endTs = admin.firestore.Timestamp.fromDate(end);

    let snap;
    try {
        snap = await db
            .collection(BUYER_PRODUCT_REQUESTS)
            .where('sellerId', '==', sellerUid)
            .where('createdAt', '>=', startTs)
            .where('createdAt', '<=', endTs)
            .limit(500)
            .get();
    } catch {
        const fallback = await db
            .collection(BUYER_PRODUCT_REQUESTS)
            .where('sellerId', '==', sellerUid)
            .where('matched', '==', false)
            .limit(400)
            .get();
        snap = fallback;
    }

    const startMs = start.getTime();
    const endMs = end.getTime();

    const docs = snap.docs.filter((d) => {
        const row = d.data();
        if (row.matched !== false) return false;
        const created = toDate(row.createdAt);
        if (!created) return false;
        return created.getTime() >= startMs && created.getTime() <= endMs;
    });

    docs.sort((a, b) => {
        const tb = toDate(b.data().createdAt)?.getTime() ?? 0;
        const ta = toDate(a.data().createdAt)?.getTime() ?? 0;
        return tb - ta;
    });

    const bucket = new Map<string, { keywords: string[]; sampleNote?: string; count: number }>();

    for (const d of docs) {
        const row = d.data();
        const kw = (row.keywords as string[]) || [];
        const key = kw.length ? kw.sort().join('|') : String(row.note || 'unknown');
        const prev = bucket.get(key);
        if (prev) prev.count += 1;
        else
            bucket.set(key, {
                keywords: kw,
                sampleNote: (row.note as string) || undefined,
                count: 1,
            });
    }

    const items: MissingDemandItem[] = [...bucket.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 25)
        .map((v) => ({
            keywords: v.keywords.length ? v.keywords : [v.sampleNote || 'unspecified'],
            sampleNote: v.sampleNote,
            count: v.count,
        }));

    return {
        items,
        appliedRange: appliedWindow(dr, start, end),
    };
}
