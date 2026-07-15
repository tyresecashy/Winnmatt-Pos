# WINNMATT POS — API Reference

author: OpenWork
verified_by: Repository Audit (Phase 1C)
verification_status: Verified
last_verified: 2026-07-14
confidence: Medium

**Purpose:** Reference for all REST API endpoints. Not a Brain document — operational reference for API consumers.

**@see** [INDEX.md](INDEX.md) · [03_ARCHITECTURE.md](03_ARCHITECTURE.md) (system architecture) · [ID_REGISTRY.md](ID_REGISTRY.md) (API- route IDs) · [lib/api/middleware.ts](../lib/api/middleware.ts)

---

## Overview

WINNMATT POS exposes 19 REST API endpoints under `/api/`. All API routes are authenticated via the `withAuth()` middleware (Bearer token → Supabase `getUser()`). Rate limiting is applied per userId+route using an in-memory token bucket.

**Base URL:** `https://winnmattpos.vercel.app/api`

---

## Authentication

All API endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <supabase_access_token>
```

Tokens are obtained via Supabase Auth (email/password sign-in). The token is validated against Supabase on each request. Expired tokens return a `401 Unauthorized` response.

---

## Endpoints

### Auth

#### GET /api/auth/profile

Get the authenticated user's profile.

**Response `200`:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "admin",
  "branch_id": "uuid",
  "name": "John Doe"
}
```

### Devices

#### POST /api/devices/heartbeat

POS device 30-second heartbeat ping.

**Request:**
```json
{
  "device_id": "uuid",
  "branch_id": "uuid",
  "status": "active"
}
```

**Response `200`:**
```json
{
  "ok": true,
  "timestamp": "2026-07-14T12:00:00Z"
}
```

### Events

#### GET /api/events/stream

Server-Sent Events (SSE) stream for real-time events.

**Query Parameters:**
- `types` (optional, comma-separated): Filter by event type (e.g., `sale.completed,stock.low`)

**Response:** SSE stream (`text/event-stream`)

### Health

#### GET /api/health

Health check endpoint.

**Response `200`:**
```json
{
  "status": "healthy",
  "db": "connected",
  "eventBus": { "mode": "in-memory" },
  "timestamp": "2026-07-14T12:00:00Z"
}
```

**Response `503`:** When database is unreachable.

### Import

#### POST /api/import/csv

Import data from CSV upload.

**Authentication:** Requires admin role
**Request:** Multipart form data with CSV file
**Response:** Import job result with success/error counts

### M-Pesa

#### POST /api/mpesa/stk-push

Initiate M-Pesa STK Push payment.

**Request:**
```json
{
  "phone": "254712345678",
  "amount": 1500,
  "sale_id": "uuid"
}
```

**Response:** STK Push request ID and status.

#### POST /api/mpesa/callback

M-Pesa STK Push callback endpoint (called by Safaricom).

**Request:** M-Pesa callback payload
**Response:** `{"ResultCode": 0, "ResultDesc": "Success"}`

#### GET /api/mpesa/status

Check M-Pesa transaction status.

**Query Parameters:**
- `checkout_request_id` (required)
- `sale_id` (required)

#### GET /api/mpesa/stream

M-Pesa-specific SSE event stream. Legacy — prefer `/api/events/stream` with `?types=mpesa.*`.

### Prices

#### POST /api/prices/approve

Approve pending price changes.

**Request:**
```json
{
  "price_change_ids": ["uuid1", "uuid2"]
}
```

**Response:** Approval result.

#### POST /api/prices/review

Submit price changes for review.

**Request:**
```json
{
  "product_id": "uuid",
  "new_price": 2500,
  "reason": "Supplier price increase"
}
```

### Stripe

#### POST /api/stripe/create-payment-intent

Create a Stripe PaymentIntent.

**Request:**
```json
{
  "amount": 1500,
  "currency": "kes",
  "sale_id": "uuid"
}
```

**Response:** Client secret for Stripe Elements.

#### POST /api/stripe/webhook

Stripe webhook receiver (called by Stripe).

**Headers:** `stripe-signature` for webhook verification
**Request:** Stripe event payload

### v1 REST API

#### GET /api/v1

API v1 index and health.

#### GET /api/v1/products

List products.

**Query Parameters:**
- `category` (optional)
- `search` (optional)

#### GET /api/v1/products/[id]

Get single product details.

#### GET/POST /api/v1/customers

Customer CRUD operations.

#### POST /api/v1/sales

Create a new sale.

**Request:**
```json
{
  "items": [
    { "product_id": "uuid", "quantity": 2, "price": 1500 }
  ],
  "payment_method": "cash",
  "amount_tendered": 3000
}
```

#### GET /api/v1/search

Global search across products, customers, and sales.

**Query Parameters:**
- `q` (required): Search query
- `type` (optional): Filter by entity type

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `RATE_LIMITED` | 429 | Too many requests |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Rate Limits

- **Default:** 100 requests per minute per user+route
- **Burst:** 20 requests per second
- **Scope:** Per authenticated user + per route path
- **Storage:** In-memory (resets on server restart)

---

## Known Gaps

1. **No API documentation served at `/api/docs`** — No Swagger/OpenAPI spec exists
2. **No versioned responses** — v1 API exists but no version negotiation
3. **No pagination standard** — Some endpoints support pagination, but not consistently
4. **No API keys** — All API auth is user-based (no machine-to-machine tokens)
5. **No request/response logging** — API calls not logged to audit trail
6. **CORS is permissive for known origins** — No wildcard, but no per-endpoint CORS
