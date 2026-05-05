# FactoryOS ERP — Architecture

## Layered design

The system uses a strict 5-layer architecture. Each layer only talks to the layer directly below it.

```
Presentation (Next.js pages + React components)
        ↕
API (Next.js Route Handlers / Server Actions)
        ↕
Business Logic (TypeScript services — workflows, validations, scoring)
        ↕
Data Access (Prisma ORM)
        ↕
PostgreSQL (Neon)
```

Cross-cutting concerns: authentication & RBAC, audit logging, notifications, validation.

## Module map

Master Data Governance (MDG) is the foundation. Every operational module depends on it:

- **MDG** — materials, suppliers, customers, BOMs, routings, work centers, warehouses, units of measure
- **Procure-to-Pay** — PR, PO, GR, supplier invoice, payment
- **Plan-to-Produce** — production plan, production order, material issue, FG receipt
- **Order-to-Cash** — sales quote, SO, shipment, customer invoice
- **Quality** — inspection lots, results, holds, NCR
- **Inventory** — ledger, balances, transfers, cycle counts
- **Planning** — forecast, MRP, shortages
- **Maintenance** — work centers, downtime, work orders
- **Finance / Record-to-Report** — journal entries, AP, AR, COGS, valuation
- **Reporting & Traceability** — supplier → lot → finished good → customer

## Critical integration rules

- No transaction can use unapproved master data (status must be ACTIVE)
- Every transaction writes an audit log
- Every inventory movement writes to inventory ledger
- Every financial event creates journal entries
- Every status change is recorded
- Every approval shows who, when, why
- Any finished good can be traced back to supplier and material lot
