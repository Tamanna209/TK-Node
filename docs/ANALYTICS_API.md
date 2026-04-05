# Seller & buyer analytics — API reference (frontend)

Base path: **`/api/analytics`**

All JSON responses use the app’s standard envelope:

```json
{
  "success": true,
  "message": "…",
  "data": { }
}
```

On error, `success` is `false` and `message` describes the problem.

---

## Authentication

| Endpoint group | Header | Role |
|----------------|--------|------|
| `GET /api/analytics/seller/*` | `Authorization: Bearer <Firebase ID token>` | User must be logged in **and** an **approved seller** |
| `POST /api/analytics/events/product-request` | Same header | Any **authenticated** user (typically buyer) |

---

## Time range (all seller `GET` endpoints)

Every seller analytics `GET` accepts the **same** query rules.

### Option A — Preset (`range`)

| Value | Meaning |
|-------|--------|
| `1d` | Last **24 hours** (rolling, ends at “now”) |
| `7d` | Last **7 days** (rolling) |
| `30d` | Last **30 days** (rolling) |
| `90d` | Last **90 days** (rolling) |
| `180d` | Last **180 days** (rolling) |

Example:

```http
GET /api/analytics/seller/summary?range=30d
```

If `range` is present, **`startDate` and `endDate` are ignored**.

### Option B — Custom calendar / ISO window (`startDate` + `endDate`)

Both parameters are **required** together.

Supported formats:

- **Date only (UTC calendar day):** `YYYY-MM-DD`  
  - `startDate` → start of that day **00:00:00.000 UTC**  
  - `endDate` → end of that day **23:59:59.999 UTC** (whole day included)
- **Full ISO datetime:** e.g. `2026-04-01T12:00:00.000Z` — used as exact instant (no automatic end-of-day expansion).

Example (April 1–5, 2026 inclusive in UTC):

```http
GET /api/analytics/seller/summary?startDate=2026-04-01&endDate=2026-04-05
```

### Option C — Default

If you omit **both** `range` and the custom pair, the backend defaults to **`7d`** (same as `range=7d`).

### Validation errors (`400`)

- Invalid `range` (not one of `1d`, `7d`, `30d`, `90d`, `180d`).
- Only **one** of `startDate` / `endDate` provided — **both** are required for custom mode.
- `startDate` after `endDate`.

---

## Applied window in responses

Seller analytics responses include **`data.appliedRange`** so the UI can show exactly what was queried:

```json
{
  "start": "2026-03-30T12:00:00.000Z",
  "end": "2026-04-06T12:00:00.000Z",
  "source": "preset",
  "preset": "7d"
}
```

| Field | Description |
|-------|-------------|
| `start` / `end` | ISO 8601 bounds actually used (inclusive end for events) |
| `source` | `"preset"` \| `"custom"` \| `"default"` |
| `preset` | Set when a preset was used (including default `7d`) |

Some responses also include a deprecated **`range`** string (`preset` key or `"custom"`) for older clients; prefer **`appliedRange`**.

---

## Endpoints

Replace `{BASE}` with your API origin, e.g. `https://api.example.com` or `http://localhost:5000`.

### 1. Summary

**`GET {BASE}/api/analytics/seller/summary`**

| Query | Example |
|-------|---------|
| Preset | `?range=7d` |
| Preset | `?range=30d` |
| Custom | `?startDate=2026-01-01&endDate=2026-03-31` |
| Default | no query → last 7 days |

**`data` shape (conceptual):**

| Field | Time-filtered? | Description |
|-------|----------------|-------------|
| `totalProducts` | No | All products for this seller |
| `activeProducts` | No | `status === "active"` |
| `archivedProducts` | No | `status === "archived"` |
| `totalViews` | Yes | Product views in window |
| `totalRequests` | Yes | Requests in window |
| `totalChats` | Yes | Chat started events in window |
| `topProducts` | Yes | Up to 5 products by **requests** in window |
| `insights` | Yes | Short strings (incl. vs previous period when possible) |
| `appliedRange` | — | See above |
| `range` | — | Deprecated; use `appliedRange` |

---

### 2. Per-product analytics

**`GET {BASE}/api/analytics/seller/products`**

Same query parameters as summary.

**`data` shape:**

```json
{
  "products": [
    {
      "productId": "string",
      "name": "string",
      "slug": "string",
      "status": "draft | active | archived",
      "views": 0,
      "clicks": 0,
      "requests": 0,
      "chats": 0,
      "performanceScore": 0
    }
  ],
  "appliedRange": { }
}
```

`performanceScore` = `views * 0.3 + requests * 0.5 + chats * 0.2` (same window).

---

### 3. Funnel

**`GET {BASE}/api/analytics/seller/funnel`**

Same query parameters.

**`data` shape:**

```json
{
  "views": 0,
  "clicks": 0,
  "chats": 0,
  "requests": 0,
  "appliedRange": { }
}
```

- `views` → `product_viewed`  
- `clicks` → `contact_clicked`  
- `chats` → `chat_started`  
- `requests` → `request_created`  

---

### 4. Trends (daily breakdown)

**`GET {BASE}/api/analytics/seller/trends`**

Same query parameters.

**`data` shape:**

```json
{
  "daily": [
    {
      "date": "2026-04-01",
      "views": 0,
      "requests": 0,
      "chats": 0
    }
  ],
  "series": [
    { "date": "2026-04-01", "requests": 0 }
  ],
  "appliedRange": { },
  "range": "7d"
}
```

- **`daily`** — primary chart data (UTC dates `YYYY-MM-DD`).
- **`series`** — requests-only; kept for backward compatibility.

---

### 5. Inventory insights

**`GET {BASE}/api/analytics/seller/inventory`**

Same query parameters.

**`data` shape:**

```json
{
  "lowStock": [
    {
      "productId": "string",
      "name": "string",
      "sku": "string",
      "quantity": 0,
      "lowStockThreshold": 0
    }
  ],
  "outOfStock": [
    { "productId": "string", "name": "string", "sku": "string" }
  ],
  "fastSelling": [
    { "productId": "string", "name": "string", "requests": 0 }
  ],
  "deadStock": [
    { "productId": "string", "name": "string", "slug": "string" }
  ],
  "appliedRange": { }
}
```

| Bucket | Time-aware? |
|--------|-------------|
| `lowStock` / `outOfStock` | No (current variant quantities) |
| `fastSelling` | Yes — high **requests in the selected window** |
| `deadStock` | Yes — **active** products with **no requests** in the window |

---

### 6. Missing demand

**`GET {BASE}/api/analytics/seller/missing-demand`**

Same query parameters.

**`data` shape:**

```json
{
  "items": [
    {
      "keywords": ["string"],
      "sampleNote": "string",
      "count": 0
    }
  ],
  "appliedRange": { }
}
```

Aggregated from buyer requests flagged as **not matching** the seller’s catalog, **within** `createdAt` in the selected window.

---

### 7. Record product request (buyer)

**`POST {BASE}/api/analytics/events/product-request`**

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Body:**

```json
{
  "productId": "string (required)",
  "keywords": ["optional", "strings"],
  "note": "optional string, max 2000 chars"
}
```

**Success:** `201`, `data` typically `{ "ok": true }`.

**Errors:**

- `404` — product not found  
- `400` — e.g. seller requesting own product  
- `401` — missing/invalid token  
- `400` — validation (Zod)  

---

## Example URLs (copy-paste)

Assuming `BASE = http://localhost:5000` and a valid Bearer token:

```text
# Presets
GET http://localhost:5000/api/analytics/seller/summary?range=7d
GET http://localhost:5000/api/analytics/seller/summary?range=30d
GET http://localhost:5000/api/analytics/seller/products?range=90d
GET http://localhost:5000/api/analytics/seller/funnel?range=180d
GET http://localhost:5000/api/analytics/seller/trends?range=7d
GET http://localhost:5000/api/analytics/seller/inventory?range=30d
GET http://localhost:5000/api/analytics/seller/missing-demand?range=30d

# Custom UTC date range (inclusive end date)
GET http://localhost:5000/api/analytics/seller/summary?startDate=2026-01-01&endDate=2026-03-31
GET http://localhost:5000/api/analytics/seller/trends?startDate=2026-04-01&endDate=2026-04-05

# Default window (7 days) — no query
GET http://localhost:5000/api/analytics/seller/summary
```

---

## HTTP status quick reference

| Code | When |
|------|------|
| `200` | Success (GET) |
| `201` | Product request recorded |
| `400` | Bad range / dates / validation |
| `401` | No or invalid Bearer token |
| `403` | Authenticated but not an approved seller (seller routes) |
| `404` | Product not found (product-request) |
| `500` | Server error |

---

## Frontend checklist

1. Send **`Authorization: Bearer <Firebase ID token>`** on every call.
2. For seller dashboards, ensure the user is an **approved seller** before calling `/seller/*`.
3. Build query strings as:  
   - either **`range=7d`** (etc.),  
   - or **`startDate=...&endDate=...`**,  
   - not both (if both sent, **`range` wins**).
4. Display **`data.appliedRange`** so users see the exact period.
5. For “contact from product” and request flows, the app should already call the backend routes that **emit analytics events** (product view, chat with `productId`, `POST .../events/product-request`); otherwise charts will stay empty.

---

*Generated for the TK Node backend analytics module. Update `BASE` and auth flow to match your environments (staging / production).*
