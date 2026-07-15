# WINNMATT POS — Brain INDEX

author: OpenWork
verified_by: User
verification_status: Verified (Phase 0)
last_verified: 2026-07-14
confidence: High
stable_id: INDEX

**Brain Version:** 1.2.0 (Sprint 11B)  
**Status:** 🟢 Sprint 11B — 23 of 23 documents written (+5 supplemental)

---

## Purpose

This INDEX is the bootloader for the WINNMATT POS Brain — a structured knowledge layer spanning vision, architecture, decisions, and living state. It contains the stable ID registry, navigation map, and loading rules for AI agents and human readers.

When entering the project, read this file first to route to the relevant documents. Do not read all documents — read only what you need based on your task.

---

## Navigation Map

| ID | Document | Status | Category | Freshness | Task Trigger |
|----|----------|--------|----------|-----------|--------------|
| **D-00** | `00_VISION.md` | ✅ Written | Permanent | 180 days | Any task about project purpose, identity, north star |
| **D-01** | `03_ARCHITECTURE.md` | ✅ Written | Permanent | 180 days | Architecture overview, layer diagram, external services |
| **D-02** | `02_PRINCIPLES.md` | ✅ Written | Permanent | 180 days | Engineering/architecture decisions, tech stack rationale |
| **D-03** | `04_MODULE_MAP.md` | ✅ Written | Permanent | 180 days | Module inventory, adapter pattern, test coverage |
| **D-04** | `05_DATABASE.md` | ✅ Written | Permanent | 180 days | Migration inventory, major table groups, RLS |
| **D-05** | `06_DESIGN_SYSTEM.md` | ✅ Written | Permanent | 180 days | UI primitives, components, visual identity |
| **D-06** | `17_SECURITY.md` | ✅ Written | Permanent | 180 days | Auth, RBAC, RLS, security headers, known gaps |
| **D-07** | `07_MOTION.md` | ✅ Written | Permanent | 90 days | Animation questions, framer-motion patterns |
| **D-08** | `08_COPYWRITING.md` | ✅ Written | Permanent | 90 days | UX copy, voice, tone, terminology |
| **D-09** | `10_AI_ARCHITECTURE.md` | ✅ Written | Permanent | 180 days | AI assistant spec, tool architecture, LLM integration |
| **D-10** | `10_PROMPT_LIBRARY.md` | ✅ Written | Permanent | 180 days | AI prompting patterns, tool schemas, response formats |
| **D-11** | `11_EVENT_CATALOG.md` | ✅ Written | Permanent | 180 days | All event types, emitters, payloads, subsystems |
| **D-12** | `18_TESTING.md` | ✅ Written | Permanent | 180 days | Testing strategy, test inventory, coverage gaps |
| **D-13** | `13_DECISIONS.md` | ✅ Written | Permanent | 180 days | Architecture decision records |
| **D-14** | `14_CHANGELOG.md` | ✅ Written | Living | 90 days | Release history, sprint summaries |
| **D-15** | `15_ROADMAP.md` | ✅ Written | Living | 90 days | Planned phases, task inventory, milestones |
| **D-16** | `16_PRODUCT_INTELLIGENCE.md` | ✅ Written | Living | 90 days | Product Intelligence — scoring, forecasting, insights, KPI tracking |
| **D-17** | `19_ANALYTICS.md` | ✅ Written | Permanent | 180 days | Analytics services, metric types, report builder |
| **D-18** | `16_PERFORMANCE.md` | ✅ Written | Living | 90 days | Current optimizations, bundle analysis, recommendations |
| **D-19** | `19_ACTIVE_BUGS.md` | ✅ Written | Living | 7 days | Active bugs, env var gaps, B- bug IDs |
| **D-20** | `20_TECH_DEBT_LOG.md` | ✅ Written | Living | 30 days | Technical debt inventory, TD- IDs, effort estimates |
| **D-21** | `21_WORKSPACE_STATE.md` | ✅ Written | Living | 7 days | Current sprint, blockers, next actions |
| **D-22** | `22_RELEASE_PLAN.md` | ✅ Written | Living | 90 days | Release candidates, milestones, rollback plan |

**Total:** 23 written · 0 pending · 23 total (D-00 through D-22, all written)

---

## Stable ID Registry

> **Central source:** [`docs/ID_REGISTRY.md`](ID_REGISTRY.md) — the single source of truth for all stable identifiers.

| Prefix | Type | Range | Status |
|--------|------|-------|--------|
| D- | Brain Documents | 00–22 | ✅ Registered |
| M- | Modules | 00–24 | ✅ Registered |
| T- | Database Tables | _(pending catalog)_ | 🟡 Pending |
| C- | Decisions | 001–999 | ✅ Registered |
| B- | Bugs | 001–999 | 🟡 7 active |
| E- | Events | 001–999 | ✅ Registered |
| API- | API Routes | 001–999 | ✅ Registered |
| F- | Features | 001–999 | 🟡 Pending |
| K- | KPIs | 001–999 | ✅ Registered |
| W- | Workflows | 001–999 | 🟡 Pending |

**Rules:** IDs are append-only, never reused. Removed entities become tombstones. See [ID_REGISTRY.md](ID_REGISTRY.md) for the complete catalog.

---

## AI Loading Rules

1. **Always start here.** Read INDEX.md first to identify which 1–3 documents are relevant to the current task.
2. **Do not batch-load** all documents. Read only the ones matching the task trigger column above.
3. **Freshness matters.** If a document exceeds its freshness period, flag it as stale and note the date. Do not silently use stale data.
4. **Permanent vs Living.**
   - `Permanent` documents (Vision, Principles, Design) change rarely; cache freely.
   - `Living` documents (Changelog, Workspace State, Bugs, Debt) update frequently; re-read each session.
5. **AGENTS.md is the operational companion.** The Brain is now complete (23/23 documents). AGENTS.md remains the best source for sprint-level implementation details and build/test commands.

---

## Relationship Map

```
INDEX ──► D-00 (Vision)            ── sets direction for all
        ──► D-01 (Architecture)    ── system layer diagram
        ──► D-02 (Principles)      ── governs architecture choices
        ──► D-03 (Module Map)      ── module inventory & coverage
        ──► D-04 (Database)        ── schema & migration guide
        ──► D-05 (Design System)   ── UI primitives & visual ID
        ──► D-06 (Security)        ── auth, RBAC, RLS, gaps
        ──► D-07 (Motion)          ── UI animation primitives
        ──► D-08 (Copywriting)     ── UX voice standards
        ──► D-09 (AI Architecture) ── assistant spec & tools
        ──► D-10 (Prompt Library)  ── prompt patterns & schemas
        ──► D-11 (Event Catalog)   ── event types & emitters
        ──► D-12 (Testing)         ── strategy & coverage
        ──► D-13 (Decisions)       ── logs each ADR
        ──► D-14 (Changelog)       ── maps releases to sprints
        ──► D-15 (Roadmap)         ── planned phases & milestones
        ──► D-16 (Product Intel.)  ── scoring, forecasting, KPI, insights
        ──► D-17 (Analytics)       ── BI services & metrics
        ──► D-18 (Performance)     ── optimizations & budgets
        ──► D-19 (Active Bugs)     ── bug tracking & env gaps
        ──► D-20 (Tech Debt Log)   ── debt inventory & priorities
        ──► D-21 (Workspace)       ── current session state
        ──► D-22 (Release Plan)    ── release gates & rollback
        ──► AGENTS.md              ── operational guide (until Brain is complete)
```

---

## References to Existing Docs (not part of Brain)

| Document | Usage |
|----------|-------|
| `AGENTS.md` | Primary operational guide — sprint details, key implementations, conventions |
| `docs/PROJECT_AUDIT_REPORT.md` | Standalone external audit — project identity, feature inventory, gaps |
| `docs/FINAL_PRODUCTION_SIGNOFF.md` | Current production readiness status (🟡 CONDITIONAL RELEASE) |
| `docs/GRAPH_AUDIT_REPORT.md` | Knowledge graph analysis (2,025 nodes, 6,715 edges) |
| `graphify-out/GRAPH_REPORT.md` | Raw graph report with community structure |
| `PRODUCTION_READINESS_CHECKLIST.md` | 837-item OWASP/NIST/CNCF/SRE checklist |
| `docs/event-catalog.md` | Event type definitions |
| `docs/PRODUCTION_LAUNCH_GATE.md` | Production launch gate criteria |
| `docs/RELEASE_CANDIDATE_1.md` | First release candidate notes |
| `docs/ARCHIVE_INDEX.md` | Catalog of deprecated/dead items (Phase 1C) |
| `docs/DEVELOPER_CHECKS.md` | Pre-commit/PR/deploy checklists, env var table |
| `docs/API_REFERENCE.md` | All 19 API endpoints with auth/response/error docs |
| `docs/DEVELOPER_ONBOARDING.md` | Setup guide, project structure, first tasks |
| `docs/CLEANUP_REPORT.md` | Repository cleanup — deleted, retained, archived items |
| `docs/PHASE_2_REPORT.md` | Phase 2 completion report — all metrics, scores, recommendation |

---

---

*Brain INDEX v1.2.0 — 23 of 23 documents written (+5 supplemental). Sprint 11B complete. Brain is complete.*
