# AI-Native Manufacturing ERP Platform

I’m building this end-to-end ERP platform to better understand and simulate how modern manufacturing companies run across product, supply chain, operations, and finance.

The idea came from observing large-scale ERP and manufacturing transformation challenges, where fragmented data across PLM, ERP, MES, procurement, inventory, and finance systems can create serious downstream execution issues.

In manufacturing, a small master data or BOM issue can quickly impact planning, procurement, production, costing, and customer fulfillment. Traditional ERP environments often make it hard to see those connections clearly.

This project is designed as a learning-first, AI-native ERP simulation that connects core workflows such as:

- Product and material master setup
- BOM creation and governance
- Procure-to-pay
- Order-to-cash
- Inventory management
- Manufacturing readiness
- Finance and costing
- Exception tracking and AI-assisted workflow guidance

The goal is not just to build ERP screens, but to show how enterprise workflows connect end-to-end — and how AI can help detect gaps, explain impact, and improve decision-making across complex manufacturing systems.

---

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
| 4 | Plan-to-Produce | 🟢 **Phase 3 done** (chunk 8 MRP optional) | BOM-driven production end-to-end: create, release, issue (FIFO lots), confirm operations, FG receipt, completion, variance. Bidirectional supplier-to-customer traceability + KPI dashboards. |
| 5 | Inventory Management | 🟢 **Phase 2 done** | Warehouses, storage locations, ledger (immutable), balance (cached running total), dashboards (Stock / Ledger / Warehouse views). |
| 6 | Demand & Supply Planning | ⚪ Planned (Phase 5) | Forecasts, MRP, shortage analysis. |
| 7 | Record-to-Report (Finance) | ⚪ Planned (Phase 5) | Journal entries, AP/AR, COGS, valuation. |
| 8 | Quality Management | ⚪ Planned (Phase 5) | Inspection lots, results, holds, NCR. |
| 9 | Asset / Work Center Maintenance | ⚪ Planned (Phase 5) | Capacity calendars, downtime, work orders. |
| 10 | Reporting & Traceability | ⚪ Planned (Phase 5) | End-to-end supplier → lot → finished good → customer trace. |

🟢 done · 🟡 in progress · ⚪ planned

## Design principles

The project is opinionated about a few things that matter in real ERPs:

- **No transaction can use unapproved master data** — enforced at the service layer in every module
- Every state change writes an immutable **audit log** entry inside the same transaction
- **Inventory ledger is the source of truth** — every stock move is one signed row, balance is a derived running total
- **Documents flow forward, never back-edit** — to "undo" a posted GR you post a reversal, never edit the original
- **Decimal arithmetic everywhere money or quantity matters** — no JS float drift in BOM explosion, line totals, or stock balances

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

### Done so far (Chunks 1–7)

- **Schema**: `WorkCenter`, `BillOfMaterials` + lines, `Routing` + operations, `ProductionOrder` + components + operations. 5 new enums covering BOM/Routing/Order/Operation status + work-center type.
- **Master data seed**: 1 finished good (Compute Module CM-100), 1 semi-finished (Power Supply Board PSB-A1), 3 work centers (SMT, Assembly, Test), 1 active 5-line BOM, 1 active 3-step routing.
- **Production Order create + BOM explosion**: pick a material, enter a quantity, the system finds the active BOM, runs `plannedQty = bomLineQty × orderQty × (1 + scrapPercent/100)` in `Prisma.Decimal`, snapshots the routing's setup + run hours, all in one transaction. **Decimal precision proven** — `406` exact, not `405.99999999999994`.
- **Release flow with material availability check**: per-component `available = inventory_on_hand − reserved_by_other_active_orders`; release blocked if any shortage; on release sets `reservedQuantity = plannedQuantity` per component.
- **Material issue**: posts negative `MATERIAL_ISSUE` ledger entries (reusing the Phase 2 inventory helper), increments `issuedQuantity`, decrements `reservedQuantity`, flips `RELEASED → IN_PROGRESS` on first issue, all transactional.
- **Cancel** for DRAFT or RELEASED orders, releases reservations.
- **Operation confirm + skip** (Chunk 4): per-operation pages capture actual setup + run hours, compute live variance vs plan, audit `setupVarianceHours` + `runVarianceHours` in metadata. Skip requires a reason. Work-center detail page shows the live operation queue across all open orders.
- **FG receipt + completion + variance** (Chunk 5): new `PRODUCTION_RECEIPT` inventory movement type, FG receipt posts positive ledger entries, increments `completedQuantity` + `scrappedQuantity`, auto-flips to `COMPLETED` when totals reach plan, audits with yield %. Variance card on the detail page shows planned vs actual quantity (stacked progress bar with scrap in red), yield %, scrap %, and aggregate hour variance.
- **Lot tracking + supplier-to-customer traceability** (Chunk 6): every GR creates a `MaterialLot` tagged with supplier; every material issue does FIFO lot consumption + writes `MaterialLotConsumption` rows; every FG receipt creates a `FinishedGoodLot`. **Bidirectional trace viewer** — pick a FG lot, see every supplier lot that fed it. Pick a material lot, see every FG that contains it.
- **Manufacturing KPI dashboard** (Chunk 7): single page aggregating order-status distribution, yield-by-material, work-center utilization (planned vs actual hours), top over-plan operations leaderboard, and cycle-time stats (avg/min/max per material). Color-coded thresholds.
- 16 pages total under `/manufacturing` covering production orders, BOMs, routings, work centers, operation confirm/skip, FG receipt, traceability, and KPIs.

### Pending (Chunk 8 — optional)

- **Chunk 8** — Demand forecast + planning runs / MRP. The "planning brain" that scans demand vs on-hand + reserved + on-order, recommends production orders, and ties forecasts to actual builds.

### Verification

Five integration tests cover the manufacturing path:

```bash
npx tsx scripts/integration-test-phase3.ts          # chunk 2: create + BOM explosion (Decimal precision)
npx tsx scripts/integration-test-phase3-chunk3.ts   # chunk 3: release + shortage + issue + status flip
npx tsx scripts/integration-test-phase3-chunk4.ts   # chunk 4: confirm + skip + variance metadata
npx tsx scripts/integration-test-phase3-chunk5.ts   # chunk 5: FG receipt + completion + variance
npx tsx scripts/integration-test-phase3-chunk6.ts   # chunk 6: lot tracking + bidirectional trace
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
  - [x] Chunk 4 — Operation confirmations + work-center queue
  - [x] Chunk 5 — FG receipt + completion + variance
  - [x] Chunk 6 — Lot tracking + bidirectional traceability viewer
  - [x] Chunk 7 — Manufacturing KPI dashboards
  - [ ] Chunk 8 (optional) — Demand forecast + planning runs / MRP
- [ ] **Phase 4** — Order-to-Cash (Sales Orders → Shipments → Customer invoicing)
- [ ] **Phase 5** — Demand planning, finance posting, quality, maintenance, traceability dashboards

## License

MIT
