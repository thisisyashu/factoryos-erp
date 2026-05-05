# FactoryOS ERP

Enterprise ERP prototype for a mid-size electronics / semiconductor manufacturing company, with deep focus on **Master Data Governance (MDG)**, approval workflows, audit trails, and end-to-end traceability from supplier to customer.

> Built as a portfolio project to demonstrate enterprise ERP transformation thinking, MDG governance design, manufacturing process modeling, and AI-assisted full-stack development.

## Why this project

Most ERP demos are CRUD apps with no governance. Real ERPs live and die by master data quality — a wrong supplier record causes payment failures, a wrong BOM causes production scrap, a wrong material status breaks every downstream transaction.

FactoryOS makes MDG the centerpiece, not an afterthought:

- Controlled status lifecycle (Draft → Submitted → In Review → Approved → Active → Inactive)
- No transaction can use unapproved master data
- Every change goes through an approval workflow
- Every action writes an immutable audit log
- Duplicate detection at request time, not after the fact
- Data quality scoring on every record

## Tech stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- PostgreSQL (Neon)
- Prisma ORM
- NextAuth (Auth.js v5)
- Zod for validation

## Modules

| # | Module | Status |
|---|---|---|
| 1 | Master Data Governance (MDG) | 🟡 Phase 1 in progress |
| 2 | Procure-to-Pay | ⚪ Phase 2 |
| 3 | Order-to-Cash | ⚪ Phase 4 |
| 4 | Plan-to-Produce | ⚪ Phase 3 |
| 5 | Inventory Management | ⚪ Phase 2 |
| 6 | Demand & Supply Planning | ⚪ Phase 5 |
| 7 | Record-to-Report (Finance) | ⚪ Phase 5 |
| 8 | Quality Management | ⚪ Phase 5 |
| 9 | Asset / Work Center Maintenance | ⚪ Phase 5 |
| 10 | Reporting & Traceability | ⚪ Phase 5 |

## Phase 1 scope

The MDG foundation:

- Material, Supplier, Customer master data
- Approval workflow engine
- Audit log
- Duplicate detection
- Data quality scoring
- Role-based access control (Requester, Steward, Approver, Admin, Viewer)

See [`docs/phase-1-spec.md`](docs/phase-1-spec.md) for screen specifications and [`docs/architecture.md`](docs/architecture.md) for system design.

## Getting started

```bash
npm install

cp .env.example .env
# Edit .env and paste your Neon DATABASE_URL

npx prisma migrate dev
npx prisma db seed

npm run dev
```

Open http://localhost:3000.

### Seeded login credentials

All users have password `password123`:

| Email | Role |
|---|---|
| requester@factoryos.com | Requester |
| steward@factoryos.com | Steward |
| approver@factoryos.com | Approver |
| admin@factoryos.com | Admin |

## Roadmap

- [x] Phase 1.0 — Project scaffold, MDG schema, seed data, documentation
- [ ] Phase 1.1 — Auth + layout shell
- [ ] Phase 1.2 — Material master CRUD + approval workflow
- [ ] Phase 1.3 — Supplier + Customer master with duplicate detection
- [ ] Phase 1.4 — Approval inbox
- [ ] Phase 1.5 — Audit history viewer
- [ ] Phase 1.6 — MDG dashboard

## License

MIT
