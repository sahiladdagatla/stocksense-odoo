<p align="center"><img src="design/logo/stocksense-logo.svg" alt="StockSense" width="360"></p>

# StockSense – Inventory Management System

StockSense is a full-stack inventory system for multi-warehouse operations: receipts, delivery orders,
internal transfers and stock counts, all recorded in one append-only, auditable stock ledger.

- **Live dashboard**: KPIs, 7-day movement chart, reorder alerts with "~N days left", one-click draft receipts
- **Operations**: one workflow for receipts, deliveries and transfers (Draft → Waiting → Ready → Done), table and Kanban views, PDF delivery slips
- **Stock ledger**: every movement is recorded and never edited; an integrity check proves stock levels match history
- **Scan Mode**: phone camera reads product QR labels and receives, delivers, moves or counts stock in one step
- **Real-time**: every open screen refreshes via Socket.io when stock changes
- **Roles**: Managers maintain master data and manage users (promote, deactivate); Staff run day-to-day operations

## Quick start

Requirements: **Node.js 20+** and **PostgreSQL** (use either option below).

```bash
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Start a database, **either**:

```bash
npm run db:start      # zero-install embedded PostgreSQL (keep this terminal open)
```

**or** with Docker:

```bash
npm run db:up         # PostgreSQL 17 via docker-compose
```

Then, in a new terminal:

```bash
npm run db:migrate    # create tables, constraints and ledger trigger
npm run seed          # demo data (wipes the database first)
npm run dev           # API on :4000, web app on http://localhost:5173
```

### Demo accounts

| Role    | Email                    | Password      |
| ------- | ------------------------ | ------------- |
| Manager | `manager@stocksense.dev` | `Manager@123` |
| Staff   | `staff@stocksense.dev`   | `Staff@123`   |

The login page has one-click buttons for both.

### Scan Mode on a phone

Browsers only allow camera access over HTTPS, so run:

```bash
npm run dev:https
```

Open the **Network** URL that Vite prints (e.g. `https://192.168.x.x:5173`) on a phone on the same Wi-Fi,
accept the self-signed certificate, and go to **Scan Mode**. Print or display a product label (Product → Label)
and point the camera at it. Without a camera you can type the SKU instead.

### Password reset email

Password reset sends a 6-digit code. If `SMTP_HOST` is empty in `server/.env`, the code is **printed in the
server console**, so the flow works without an email account.

## Architecture

### Everything is a stock move

Every inventory operation is modelled as a **move of stock from one location to another**. The outside world
is represented by **virtual locations**, so every move has both ends inside the system:

| Operation         | Source → Destination                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Receipt           | `Vendors` (virtual) → internal location                                                   |
| Delivery          | internal location → `Customers` (virtual)                                                 |
| Internal transfer | internal location → internal location                                                     |
| Adjustment        | internal location ↔ `Inventory Loss` (virtual), direction from the sign of the difference |

- **`StockMove`** is the ledger. It is append-only: a PostgreSQL trigger rejects any `UPDATE` or `DELETE`.
- **`StockQuant`** (product + location → quantity) is a cache of on-hand stock for internal locations. It is only
  written in the same transaction that writes the moves.
- Virtual locations never hold quants and never run out, which is what makes receipts and deliveries balance.

### The stock engine

One function, `validateOperation(operationId, userId)` in `server/src/services/stock.service.ts`,
validates every operation type. In a single database transaction it:

1. locks the operation row and all affected quant rows (`SELECT … FOR UPDATE`, in a fixed order to avoid deadlocks);
2. rejects operations that are already Done or Canceled, or not yet confirmed;
3. checks that the source location has enough stock (`INSUFFICIENT_STOCK` names the product);
4. moves the quants, writes the `StockMove` rows, and marks the operation Done.

After commit it broadcasts `stock:updated`. Any waiting deliveries or transfers whose stock is now available
move to Ready automatically.

Guarantees are also enforced by the database itself: stock can never go negative (`CHECK quantity >= 0`), move
quantities must be positive, internal locations must belong to a warehouse, and references like `WH1/IN/0001`
come from an atomic sequence.

### Integrity check

**Move History → Run integrity check** (`GET /api/moves/integrity-check`) recomputes every stock balance from
the raw ledger and compares it with `StockQuant`. An empty discrepancy list proves the cache and the history agree.

### Code layout

```
server/  Express + TypeScript + Prisma
  prisma/          schema, migrations, seed (history created through the real services)
  src/routes       → controllers → services → Prisma (business logic lives only in services)
  src/schemas      Zod validation for every input
  tests/           Vitest: engine, concurrency, API, end-to-end flow
client/  Vite + React + TypeScript + Tailwind + shadcn/ui
  src/pages        screens (one shared list + form drive all operation types)
  src/components   design-system components (DataTable, StatusStepper, KanbanBoard, …)
design/  UI design system (DESIGN.md), logo files (design/logo) and screen references
```

## API

All endpoints are under `/api` and require `Authorization: Bearer <token>` except the auth routes.
Errors are always `{ "error": { "code", "message" } }`. **Staff** can read everything and run operations;
creating, editing or deleting products, categories, warehouses or locations requires **Manager** (403 otherwise).

| Area        | Endpoints                                                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth        | `POST /auth/signup` · `POST /auth/login` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET/PATCH /auth/me` · `GET /auth/me/stats`                                                                                              |
| Users       | `GET /users` · `PATCH /users/:id` (Manager: change role, deactivate or reactivate; not your own account)                                                                                                                                         |
| Warehouses  | `GET/POST /warehouses` · `GET/PATCH/DELETE /warehouses/:id`                                                                                                                                                                                      |
| Locations   | `GET/POST /locations` · `GET /locations/tree` · `GET/PATCH/DELETE /locations/:id`                                                                                                                                                                |
| Categories  | `GET/POST /categories` · `PATCH/DELETE /categories/:id`                                                                                                                                                                                          |
| Products    | `GET /products?search=&categoryId=&warehouseId=&stockStatus=&page=` · `POST /products` · `GET/PATCH/DELETE /products/:id` · `GET /products/:id/stock` · `GET /products/sku/:sku`                                                                 |
| Operations  | `GET /operations?type=&status=&warehouseId=&categoryId=&search=&page=` · `GET /operations/counts` · `POST /operations` · `GET/PATCH /operations/:id` · `POST /operations/:id/confirm` · `/validate` · `/cancel` · `GET /operations/:id/slip.pdf` |
| Adjustments | `POST /adjustments`                                                                                                                                                                                                                              |
| Moves       | `GET /moves?productId=&locationId=&type=&userId=&from=&to=&search=&page=` · `GET /moves/export.csv` · `GET /moves/integrity-check`                                                                                                               |
| Dashboard   | `GET /dashboard/kpis` · `GET /dashboard/movement-chart` · `GET /dashboard/reorder` (all accept `warehouseId`, `categoryId`)                                                                                                                      |

Real-time: connect with `io(url, { auth: { token } })` to receive `stock:updated` and `operation:changed`.

## Scripts

| Command                              | What it does                                                      |
| ------------------------------------ | ----------------------------------------------------------------- |
| `npm run dev`                        | API and web app with hot reload                                   |
| `npm run dev:https`                  | Same, with HTTPS for Scan Mode on phones                          |
| `npm run db:start` / `npm run db:up` | Embedded PostgreSQL / Docker PostgreSQL                           |
| `npm run db:migrate`                 | Apply database migrations                                         |
| `npm run seed`                       | Reset and load demo data                                          |
| `npm test`                           | Run the test suite (uses the separate `stocksense_test` database) |
| `npm run check`                      | Typecheck, lint, format check and tests                           |

## Tech stack

**Server:** Node 20, Express 5, TypeScript, Prisma 6, PostgreSQL, Zod, bcrypt, JSON Web Tokens, Nodemailer,
Socket.io, pdfkit, Vitest.
**Client:** Vite, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Router, react-hook-form,
Recharts, Framer Motion, html5-qrcode, qrcode, sonner, lucide-react.
