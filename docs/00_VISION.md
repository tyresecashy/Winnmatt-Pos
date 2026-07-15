# D-00: WINNMATT POS — Vision

author: OpenWork
verified_by: User
verification_status: Verified (Phase 0)
last_verified: 2026-07-14
confidence: High
stable_id: D-00

**Freshness:** 180 days (permanent)  
**@see** [AGENTS.md](../AGENTS.md) · [D-02](02_PRINCIPLES.md) (engineering principles) · [D-14](14_CHANGELOG.md) (sprint history) · [PROJECT_AUDIT_REPORT.md](PROJECT_AUDIT_REPORT.md) §1

---

## Identity

**WINNMATT POS** is a multi-branch Point-of-Sale system for Kenyan retail businesses. It is a web application (Next.js 16 + React 19) built on Supabase (PostgreSQL + Auth), deployed on Vercel, and designed to run on any modern browser — desktop and mobile.

| Field | Value |
|-------|-------|
| **Application** | WinnMatt POS — Multi-branch Point-of-Sale System |
| **Domain** | `winnmatt.com` (target) |
| **Deployed** | `https://winnmattpos.vercel.app` (Vercel preview) |
| **Target Market** | Kenyan retail businesses |
| **Development** | Solo founder/developer + OpenWork AI agents |
| **Active Branch** | `all-fixes-and-features-20260705` |

---

## North Star

> A retailer in any Kenyan town can open a browser, log in, and run their entire business — sales, inventory, customers, suppliers, workforce, and finances — from a single system that works online and offline, on desktop and mobile, with payments that "just work" (M-Pesa, card, cash, split).

---

## Core Beliefs

1. **The browser is the platform.** A POS system should not require native app installation. Any device with a modern browser is a POS terminal.
2. **Offline is a feature, not a fallback.** Kenyan retail operates where internet is unreliable. The system must degrade gracefully.
3. **Payments are the core transaction.** M-Pesa is not a payment method — it *is* the payment method in Kenya. Everything else (card, cash, bank transfer) is secondary.
4. **Multi-branch is the default.** The system is designed from the ground up for single-owner multi-branch operations, not single store.
5. **Data drives decisions.** Every transaction feeds analytics. The system should tell the owner what's happening, not just record it.
6. **One system, all domains.** Sales, inventory, finance, HR, suppliers, customers — one login, one database, one truth.

---

## What This System Is

- A complete retail management operating system for Kenyan SMBs
- A POS that works on desktop and mobile with shift management, multiple payment methods, and receipt generation
- An inventory system with batch tracking, warehouse locations, stock counts, and reorder alerts
- A financial system with chart of accounts, general ledger, bank reconciliation, and tax configuration
- A workforce management system with shifts, attendance, leave, payroll, and task tracking
- An AI assistant that can answer business questions and perform actions via natural language
- A real-time system with device heartbeats, event streaming, and notification dispatch

## What This System Is Not

- Not a multi-tenant SaaS platform (designed for single-owner multi-branch)
- Not an e-commerce storefront (database tables exist but no buyer-facing UI)
- Not a mobile app (React Native frontend was archived in Phase 1)
- Not a replacement for statutory reporting (KRB, KRA) — though the data supports it
- Not a standalone accounting package (General Ledger exists but is integrated with POS, not a replacement for QuickBooks)

---

## Target Users

| Role | Description |
|------|-------------|
| **Owner** | Sees dashboards, analytics, cash flow; makes strategic decisions |
| **Manager** | Runs day-to-day: inventory, staff scheduling, purchase orders |
| **Cashier** | Uses POS terminal: scans items, takes payments, issues receipts |
| **Admin** | Configures system: users, permissions, tax rates, branches |

---

## Key Metrics (North Star KPIs)

These are aspirational and not yet tracked. The system should measure itself against them once instrumented.

| KPI | Target | Why |
|-----|--------|-----|
| K-001 Daily Active Cashiers | — | System adoption |
| K-002 Transaction Completion Rate | — | Payment flow reliability |
| K-003 Offline Transaction Sync Success | — | Offline mode effectiveness |
| K-004 Shift Close Accuracy | — | Cash management trust |
| K-005 Inventory Accuracy (count vs system) | — | Inventory trust |
| K-006 AI Assistant Resolution Rate | — | Feature adoption |
| K-007 Uptime (Vercel + Supabase) | — | Platform reliability |

---

*D-00 Vision — last updated 2026-07-14.*
