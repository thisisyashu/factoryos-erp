# FactoryOS ERP

Enterprise ERP prototype for a mid-size electronics / semiconductor manufacturing company, with deep focus on **Master Data Governance (MDG)**, approval workflows, audit trails, and end-to-end traceability from supplier to customer.

> Built as a portfolio project to demonstrate enterprise ERP transformation thinking, MDG governance design, manufacturing process modeling, and AI-assisted full-stack development.

## Why this project

Most ERP demos are CRUD apps with no governance. Real ERPs live and die by master data quality — a wrong supplier record causes payment failures, a wrong BOM causes production scrap, a wrong material status breaks every downstream transaction.

FactoryOS makes the **governance layer** the centerpiece, not an afterthought:

- Controlled status lifecycle (Draft → Submitted → Approved → Active → Inactive)
- **No transaction can use unapproved master data** — enforced at the service layer in every module
- Every state change writes an immutable **audit log** entry inside the same transaction
- **Inventory ledger is the source of truth** — every stock move is one signed row, balance is a derived running total
- **Documents flow forward, never back-edit** — to "undo" a posted GR you post a reversal, never edit the original
- **Decimal arithmetic everywhere money or quantity matters** — no JS float drift in BOM explosion, line totals, or stock balances

## Tech stack

- **Next.js 16** (App Router, Server Components + Server Actions, Turbopack)
- **TypeScript** end-to-end
- **Tailwind CSS** + **shadcn/ui** (Slate base color)
- **PostgreSQL** hosted on **Neon**
- **Prisma 7** ORM with the **`@prisma/adapter-neon`** driver adapter (WebSocket-based, supports multi-statement transactions)
- **NextAuth (Auth.js v5 beta)** dependency installed; replaced for now by a dev-only cookie-based session switcher (see `/dev-login`)
- **Zod 4** for input validation
- **bcryptjs** for password hashing
- **`tsx`** for the seed + integration test scripts

## Modules

| # | Module | Status | Notes |
|---|---|---|---|
| 1 | Master Data Governance (MDG) | 🟢 Foundation done | Schema + seed for User/Material/Supplier/Customer/UoM/MdgRequest/AuditLog. Approval-workflow UI deferred. |
| 2 | Procure-to-Pay | 🟢 **Phase 2 done** | PR → PO (with conversion) → Goods Receipt → Inventory Ledger. Full UI + role-gated actions + audit. |
| 3 | Order-to-Cash | ⚪ Planned (Phase 4) | Sales orders, shipments, customer invoicing. |
| 4 | Plan-to-Produce | 🟡 **Phase 3 in progress** | BOM, Routing, Work Center, Production Order with BOM explosion + release + material issue. See [Phase 3 status](#phase-3--manufacturing-in-progress) below. |
| 5 | Inventory Management | 🟢 **Phase 2 done** | Warehouses, storage locations, ledger (immutable), balance (cached running total), dashboards (Stock / Ledger / Warehouse views). |
| 6 | Demand & Supply Planning | ⚪ Planned (Phase 5) | Forecasts, MRP, shortage analysis. |
| 7 | Record-to-Report (Finance) | ⚪ Planned (Phase 5) | Journal entries, AP/AR, COGS, valuation. |
| 8 | Quality Management | ⚪ Planned (Phase 5) | Inspection lots, results, holds, NCR. |
| 9 | Asset / Work Center Maintenance | ⚪ Planned (Phase 5) | Capacity calendars, downtime, work orders. |
| 10 | Reporting & Traceability | ⚪ Planned (Phase 5) | End-to-end supplier → lot → finished good → customer trace. |

🟢 done · 🟡 in progress · ⚪ planned

## Phase 1 — MDG foundation (done)

The data foundation:

- `User` with role-based access (Requester, Steward, Approver, Admin, Viewer)
- `Material`, `Supplier`, `Customer` with `MasterDataStatus` lifecycle (DRAFT → SUBMITTED → APPROVED → ACTIVE → INACTIVE)
- `UnitOfMeasure` master
- `MdgRequest` + `MdgApproval` workflow tables
- `MdgDuplicateCandidate` for duplicate-detection capture
- Generic `AuditLog` table referenced by every module that comes after

See [`docs/architecture.md`](docs/architecture.md) for the layered design and [`docs/phase-1-spec.md`](docs/phase-1-spec.md) for the phase-1 spec.

## Phase 2 — Procurement + Inventory (done)

The first true end-to-end ERP transaction flow. Approved Supplier + Active Material → PR → PO → GR → Inventory Ledger Update.

### What works end-to-end

```
Internal need
    ↓                                    role-gated, audited
Purchase Requisition (PR)  DRAFT → SUBMITTED → APPROVED  (or REJECTED)
    ↓ convert (1:1)
Purchase Order (PO)        DRAFT → SUBMITTED → APPROVED → SENT
    ↓ supplier ships
Goods Receipt (GR)         DRAFT → POSTED  (immutable after posting)
    ↓ posting (one transaction touches 5 tables)
Inventory Ledger           +N units, signed, immutable, references the GR
    ↓
Inventory Balance          quantity-on-hand per (material × storage location)
    ↓
Inventory dashboards       Stock by material · Ledger viewer · Warehouse drill-down
```

### Highlights

- **Goods Receipt posting is one `prisma.$transaction` that mutates 5 tables**: `GoodsReceipt`, `GoodsReceiptLine`, `PurchaseOrderLine.quantityReceived`, `PurchaseOrder.status`, `InventoryLedger`, `InventoryBalance` — plus 1–2 `AuditLog` rows. If any step fails, the whole posting rolls back.
- **PR → PO conversion** is also transactional — copies PR lines into PO lines with user-chosen unit prices, sets `sourcePrId`, flips PR to `CONVERTED_TO_PO` in one go. The 1:1 unique constraint on `PurchaseOrder.sourcePrId` is a DB-level safeguard against double-conversion.
- **Over-receipt rejection is qty-aware**: `receiving 200 exceeds remaining 40 (ordered 100, already received 60)`.
- **Inventory ledger immutability is a convention.** No `updatedAt` column, no service function that updates it. To reverse a movement you post a *negative* one.
- **Atomic balance updates via Prisma's `increment`** — single SQL UPSERT, no race within a transaction.
- **Dev-only session switcher at `/dev-login`** — cookie-based, no password, ~30 lines. Pick any seeded user; replaceable with NextAuth credentials when production-ready.

### Pages added in Phase 2

- `/dev-login` — pick a user, set the session cookie
- `/procurement/purchase-requisitions` — list + create + detail + approval card
- `/procurement/purchase-orders` — list + manual create + detail with state machine
- `/procurement/purchase-orders/new?fromPr=<id>` — convert-PR mode of the same form
- `/procurement/goods-receipts` — list + PO picker + receive form + read-only detail
- `/inventory` — landing with stat tiles
- `/inventory/stock` — stock by material × location, filterable
- `/inventory/ledger` — paginated movement history with 5 filters and reference links
- `/inventory/warehouses` + `/inventory/warehouses/[id]` — warehouse drill-down

### Verification

`scripts/integration-test-phase2.ts` walks the full PR → PO → GR flow against the live Neon DB, verifying ledger entries and balance deltas. Re-runnable any time:

```bash
npx tsx scripts/integration-test-phase2.ts
```

## Phase 3 — Manufacturing (in progress)

BOM-driven production: turning approved materials into finished goods through routings and operations, with full inventory integration.

### Done so far (Chunks 1–3)

- **Schema**: `WorkCenter`, `BillOfMaterials` + lines, `Routing` + operations, `ProductionOrder` + components + operations. 5 new enums covering BOM/Routing/Order/Operation status + work-center type.
- **Master data seed**: 1 finished good (Compute Module CM-100), 1 semi-finished (Power Supply Board PSB-A1), 3 work centers (SMT, Assembly, Test), 1 active 5-line BOM, 1 active 3-step routing.
- **Production Order create + BOM explosion**: pick a material, enter a quantity, the system finds the active BOM, runs `plannedQty = bomLineQty × orderQty × (1 + scrapPercent/100)` in `Prisma.Decimal`, snapshots the routing's setup + run hours, all in one transaction. **Decimal precision proven** — `406` exact, not `405.99999999999994`.
- **Release flow with material availability check**: per-component `available = inventory_on_hand − reserved_by_other_active_orders`; release blocked if any shortage; on release sets `reservedQuantity = plannedQuantity` per component.
- **Material issue**: posts negative `MATERIAL_ISSUE` ledger entries (reusing the Phase 2 inventory helper), increments `issuedQuantity`, decrements `reservedQuantity`, flips `RELEASED → IN_PROGRESS` on first issue, all transactional.
- **Cancel** for DRAFT or RELEASED orders, releases reservations.
- 9 pages under `/manufacturing` (landing, production-orders list/new/detail, BOMs list/detail, routings list/detail, work centers list, issue-materials form).

### Pending (Chunks 4–7)

- **Chunk 4** — Operation confirmations + work-center queue
- **Chunk 5** — FG receipt + production completion + variance display
- **Chunk 6** — Lot tracking + traceability (supplier → lot → PO → GR → production order → FG lot)
- **Chunk 7** — Manufacturing KPI dashboards (planned vs actual, yield %, scrap %, work-center utilization, cycle time)
- **Chunk 8 (optional)** — Demand forecast + planning runs / MRP

### Verification

Three integration tests cover the manufacturing path so far:

```bash
npx tsx scripts/integration-test-phase3.ts          # create + BOM explosion
npx tsx scripts/integration-test-phase3-chunk3.ts   # release + shortage + issue + status flip
```

## Getting started

```bash
nvm use 20                  # required (Next.js 16 + Prisma 7)
npm install

cp .env.example .env
# Edit .env and paste your Neon DATABASE_URL

npm run migrate -- --name init   # or: npx prisma migrate dev
npx prisma db seed               # seeds Phase 1 + Phase 2 + Phase 3 master data

npm run dev
```

Open http://localhost:3000. Sign in via `/dev-login` with any seeded user.

### Seeded login credentials

All users have password `password123`:

| Email | Role | Use it for |
|---|---|---|
| requester@factoryos.com | Requester | Create PR, PO, production orders, issue materials |
| steward@factoryos.com | Steward | Browse master data |
| approver@factoryos.com | Approver | Approve PR/PO, release production orders, cancel orders |
| admin@factoryos.com | Admin | Anything |

Switch users any time by visiting `/dev-login` and clicking another row.

### Suggested 5-minute demo flow

1. Sign in as **Riya Requester** at `/dev-login`.
2. **Procurement → Purchase Orders → + Create PO** with supplier `SUP-000001`, receive any material.
3. Switch to **Aisha Approver**, approve the PO, mark sent, click **Receive goods** → fill quantities → **Post**. Open **Inventory → Stock** to see your new balance.
4. **Manufacturing → Production Orders → + Create order**, pick `MAT-100100 Compute Module CM-100`, qty `50`. Land on detail showing the BOM-explosion table (5 components with planned quantities) and the operations snapshot.
5. The **Material availability** card shows shortages in red — receive more components via Procurement to clear them, then come back and **Release for production** as Aisha.
6. As Riya, **Issue materials** → fills a form pre-populated with each component's remaining qty + a source-location dropdown. Post → order flips to `IN_PROGRESS`, inventory ledger gets 5 negative `MATERIAL_ISSUE` entries.

## Project layout

```
src/
├── app/
│   ├── dev-login/                    # cookie-based session switcher
│   ├── procurement/                  # Phase 2: PR / PO / GR
│   ├── inventory/                    # Phase 2: stock / ledger / warehouses
│   └── manufacturing/                # Phase 3: PO / BOM / routing / WC
└── lib/
    ├── db.ts                         # shared Prisma + Neon adapter client
    ├── audit.ts                      # writeAudit helper (transaction-aware)
    ├── numbering.ts                  # PR-2026-NNNNNN, PO-, GR-, PRO- generators
    ├── current-user.ts               # session reader + role guards
    ├── services/                     # all business logic — testable, no React
    └── validators/                   # Zod schemas

prisma/
├── schema.prisma                     # all 3 phases of models
├── migrations/                       # 3 migrations
└── seed.ts                           # idempotent: re-runs cleanly

scripts/
├── integration-test-phase2.ts        # PR → PO → GR e2e
├── integration-test-phase3.ts        # production order create + BOM explosion
├── integration-test-phase3-chunk3.ts # release + shortage + issue + status flip
└── verify-phase3-seed.ts             # quick manual check of Phase 3 seed
```

## Architectural choices worth knowing

1. **Server Components for reads, Server Actions for writes.** No REST API surface yet — pages call `lib/services/*` directly, mutations go through `actions.ts` files co-located with the form. End-to-end type safety, no JSON boundary.
2. **Every page that hits the DB exports `runtime = "nodejs"`** — the Neon adapter uses WebSockets via the `ws` package which is Node-only.
3. **`Prisma.Decimal` everywhere quantity or money matters.** `Number` is allowed only at the rendering boundary.
4. **Transactional audit writes.** Every state change includes its `writeAudit({..., tx})` call inside the same `$transaction` as the business write — they commit or roll back together.
5. **Snapshot semantics.** Production orders snapshot the BOM + routing at create time so the order keeps its original requirements even if master data changes later — same audit-trail promise an SAP production order makes.

## Roadmap

- [x] **Phase 1.0** — Project scaffold, MDG schema, seed data, documentation
- [x] **Phase 2** — Procurement + Inventory foundation
  - [x] Chunk 1 — Schema + warehouse/location seed
  - [x] Chunk 2 — Shared lib (db, audit, numbering, current-user, validators)
  - [x] Chunk 3 — PR end-to-end (service + actions + UI + state machine)
  - [x] Chunk 4 — PO end-to-end + Convert PR → PO
  - [x] Chunk 5 — GR posting + inventory ledger/balance updates
  - [x] Chunk 6 — Inventory dashboards (Stock / Ledger / Warehouses)
- [ ] **Phase 3** — Manufacturing
  - [x] Chunk 1 — Schema (BOM/Routing/WorkCenter/ProductionOrder) + master-data seed
  - [x] Chunk 2 — Production Order create + BOM explosion + master-data UI
  - [x] Chunk 3 — Release + material availability + material issue + IN_PROGRESS
  - [ ] Chunk 4 — Operation confirmations + work-center queue
  - [ ] Chunk 5 — FG receipt + completion + variance
  - [ ] Chunk 6 — Lot tracking + traceability viewer
  - [ ] Chunk 7 — Manufacturing KPI dashboards
- [ ] **Phase 4** — Order-to-Cash (Sales Orders → Shipments → Customer invoicing)
- [ ] **Phase 5** — Demand planning, finance posting, quality, maintenance, traceability dashboards

## License

MIT
