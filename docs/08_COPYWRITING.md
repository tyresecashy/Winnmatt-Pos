# D-08: WINNMATT POS — UX Copywriting Guide

author: OpenWork
verified_by: User
verification_status: Verified (Phase 0)
last_verified: 2026-07-14
confidence: High
stable_id: D-08

**Freshness:** 90 days (permanent)  
**@see** [AGENTS.md](../AGENTS.md) · [D-00](00_VISION.md) (target market) · [D-07](07_MOTION.md) (animation + UX)

---

## Target Audience

Primary users are Kenyan retail staff and owners. The system must work for:
- **Cashiers** — may have limited computer experience. Clear, unambiguous labels.
- **Managers** — need to make decisions from data. Concise, actionable insights.
- **Owners** — want the bottom line. Summary, trends, exceptions.

---

## Voice Principles

| Principle | Guideline |
|-----------|-----------|
| **Clear over clever** | Never sacrifice clarity for wordplay. Avoid jargon unless the domain requires it. |
| **Professional but warm** | Not casual ("hey"), not cold ("transaction denied. code 403."). Find the middle. |
| **Helpful, not blaming** | Errors say what happened and what to do next. Never "you did something wrong." |
| **Short** | Every word earns its place. Eliminate filler. |

---

## Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| **POS checkout** | Direct, fast, trustworthy | "Select payment method → Confirm → Receipt sent to phone" |
| **Error message** | Helpful, specific | "Could not reach M-Pesa. Check paybill number and try again." |
| **Empty state** | Encouraging, actionable | "No sales today. Start by opening a shift." |
| **Confirmation** | Reassuring, specific | "Sale complete. Receipt #INV-241 sent to 07XX XXX XXX." |
| **Analytics** | Informative, data-driven | "Sales up 12% this week compared to last week." |
| **AI assistant** | Conversational, deferential | "I found 5 low-stock items. Shall I create purchase orders?" |

---

## Terminology

| Preferred | Avoid | Reason |
|-----------|-------|--------|
| Shift | Session | Shift is the industry term in retail |
| Sale, Transaction | Order, Ticket | Order implies e-commerce; sale is POS-specific |
| Customer | Client, Patron | Customer is unambiguous in Kenyan retail |
| Supplier | Vendor | Supplier is the standard term in procurement |
| Branch | Store, Location | Branch implies multi-site management |
| Cashier | Operator, Attendant | Cashier is the recognized role |
| Receipt | Invoice, Bill | Invoice is for credit sales; receipt is for completed payment |
| Void | Cancel, Delete | Void has audit trail implications |
| M-Pesa | M-Pesa, MPesa | Use exactly "M-Pesa" with hyphen and capital M |
| Stock Count | Inventory Count | Stock Count is the established operational term |

---

## Kenyan Context

- **Currency:** KES (KSh). Format: `KSh 1,500.00`. No decimal places for whole amounts.
- **Phone numbers:** Format as `07XX XXX XXX` for display, store as `2547XXXXXXXX`.
- **Date:** DD/MM/YYYY for display (not MM/DD/YYYY).
- **M-Pesa:** The primary payment method. Prompt for M-Pesa phone number, not M-Pesa "email."
- **KRA/PIN:** For supplier and customer records, include KRA PIN field.
- **Language:** English for system UI. Swahili phrases only where contextually appropriate ("Karibu" on login, "Asante" on receipt).

---

## Writing Patterns

### Buttons
```
"Save" (not "Submit")
"Cancel" (not "Discard")
"Start Shift" (not "Open Shift Session")
"End Shift" (not "Close Cash Drawer Session")
"Pay with M-Pesa" (not "Mobile Money")
```

### Confirmations
```
"Are you sure you want to void this sale?"
→ Yes, void sale / No, keep sale
```

### Errors
```
Good:   "Could not connect to M-Pesa. Check your internet and try again."
Bad:    "MPESA_ERROR_TIMEOUT" or "Error 503"
```

### Empty States
```
"No products match your search."
"No sales recorded yet. Complete your first sale to see data here."
```

---

## Character Limits (UI Components)

| Component | Max Length | Reason |
|-----------|-----------|--------|
| Product name | 200 chars | Table column width |
| Customer name | 100 chars | Table column width |
| Receipt number | 50 chars | Database constraint |
| Phone number | 15 chars | ITU-T E.164 max |
| Search query | 100 chars | Performance (ILIKE) |

---

## ✅ What's Covered
- Voice and tone guidelines
- Terminology table with preferred/avoid pairs
- Kenyan context notes (currency, date, phone, M-Pesa, KRA PIN)
- Button label conventions
- Error and confirmation patterns

## ❌ What's Missing (Flagged)
- Swahili language strings not yet defined or translated
- No i18n framework selected
- Receipt template copy not centralized
- No UX writing review process defined

---

*D-08 Copywriting — last updated 2026-07-14.*
