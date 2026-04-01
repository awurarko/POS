# Database Connection in SmartPOS

This document explains how SmartPOS connects to MySQL, how queries move through the server, and how the schema is used during normal app operation.

The short version is:

- `server/db.js` creates a MySQL connection pool.
- `server/server.js` imports that pool as `db`.
- Most routes run direct `db.query(...)` calls for simple reads and writes.
- Checkout uses `db.getConnection()` so it can wrap the sale in a transaction.

## Where The Database Logic Lives

- Pool creation: [server/db.js](server/db.js)
- API routes and transactions: [server/server.js](server/server.js)
- Schema definition: [server/schema.sql](server/schema.sql)
- High-level project notes: [README.md](README.md)

## Connection Setup

The database pool is created with `mysql2/promise` in [server/db.js](server/db.js).

The pool reads configuration from `env.env` using `dotenv`.

### Environment variables used

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SSL`

If a value is missing, the code falls back to sensible local defaults:

- Host: `localhost`
- Port: `3306`
- User: `root`
- Password: empty string
- Database: `smartpos`

If `DB_SSL=true`, the pool enables TLS with `rejectUnauthorized: false`.

## Why A Pool Is Used

The app uses a pool instead of a single long-lived connection because the API is a web server that handles many independent requests.

A pool gives the app:

- Reusable connections
- Controlled concurrency
- Automatic waiting when all connections are busy
- Better performance than connecting from scratch for every request

The pool is configured with `connectionLimit: 10`, so up to ten connections can be active in parallel.

## How Server Routes Use The Pool

In [server/server.js](server/server.js), the pool is imported as `db`.

Most read-only and simple write routes call:

- `db.query(...)`

That is used for things like:

- Loading products
- Loading customers
- Loading sales
- Updating customer points
- Restocking inventory
- Fetching dashboard stats

For routes that need atomic multi-step behavior, the code uses:

- `db.getConnection()`
- `beginTransaction()`
- `commit()`
- `rollback()`

The sale creation path is the main example of this.

## Why Checkout Uses A Transaction

Checkout is the most important write path in the system.

When a sale is created, several things must happen together:

- A sale row must be inserted
- Each sold item must be recorded
- Product stock must be reduced
- Inventory log rows must be written
- Payment data must be saved
- Customer points may be awarded

If any one of those steps fails halfway through, the others must not remain committed.

That is why `POST /api/sales` runs inside a transaction.

## Sale Transaction Flow

Inside `POST /api/sales`, the backend does the following:

1. It gets a dedicated connection from the pool.
2. It starts a transaction.
3. It validates the incoming sale payload.
4. It inserts the sale row.
5. It loops through every cart item.
6. For each item, it locks the product row with `FOR UPDATE`.
7. It checks stock.
8. It inserts the item row.
9. It updates product stock.
10. It adds an inventory log entry.
11. It updates the sale totals.
12. It inserts the payment row.
13. It awards loyalty points when a customer is present.
14. It commits the transaction.
15. If anything fails, it rolls the transaction back.

That sequence keeps sales, stock, and payments consistent with each other.

## Schema Overview

The database schema in [server/schema.sql](server/schema.sql) creates these tables:

- `users`
- `products`
- `customers`
- `sales`
- `sales_items`
- `payments`
- `inventory_log`

## What Each Table Does

### `users`

Stores login accounts and roles.

Important fields:

- `id`
- `username`
- `password`
- `full_name`
- `role`
- `status`

### `products`

Stores the catalog and stock levels.

Important fields:

- `id`
- `name`
- `category`
- `price`
- `stock`
- `barcode`
- `supplier`

### `customers`

Stores customer contact information and loyalty points.

Important fields:

- `id`
- `name`
- `phone`
- `email`
- `address`
- `points`

### `sales`

Stores the sale header.

Important fields:

- `id`
- `cashier`
- `customer_id`
- `customer_name_manual`
- `subtotal`
- `discount`
- `total`
- `payment_method`
- `created_at`

### `sales_items`

Stores the line items for each sale.

Important fields:

- `sale_id`
- `product_id`
- `product_name`
- `quantity`
- `price`

### `payments`

Stores payment-specific data.

Important fields:

- `sale_id`
- `method`
- `amount`
- `cash_received`
- `change_due`
- `payer_number`
- `provider`
- `provider_reference`
- `payment_status`

### `inventory_log`

Stores a history of stock changes.

Important fields:

- `product_id`
- `change_qty`
- `reason`

## Relationships Between Tables

The schema is built around a classic POS pattern:

- One sale can have many sale items.
- One sale can have one payment row.
- One customer can have many sales.
- One product can appear in many sale items.
- Inventory changes are logged separately for auditability.

Foreign keys enforce these relationships and help prevent orphaned data.

## How The App Reads Data

The API uses the pool for normal data retrieval too.

Examples include:

- `GET /api/products`
- `GET /api/customers`
- `GET /api/sales`
- `GET /api/stats`
- `GET /api/reports/mvp`

These routes typically use `db.query(...)` and return JSON directly to the frontend.

## How The App Starts The Database Connection

The server loads `env.env` when it starts.

That means the connection settings are decided at process startup, not during individual requests.

Once the pool is created, the rest of the application reuses it.

## Error Handling Model

The app does not expose raw database errors to the browser as a generic stack trace.

Instead:

- The API catches errors in each route handler.
- The route sends a JSON error response with an error message.
- The frontend API layer surfaces that message to the user.

For the checkout transaction, `rollback()` is called before returning a failure.

That is the key safeguard that keeps partial sales from being stored.

## Backward Compatibility In The Schema

The code is written to survive older databases that may not yet have every newer column.

For example, the sale insertion code includes compatibility logic for the `customer_name_manual` and `payer_number` fields.

This is why some inserts have a fallback path if a column is missing.

The schema file also includes upgrade comments that describe how to add newer fields to existing databases.

## Manual Bootstrap Model

The database is not created through ORM migrations in this repo.

Instead, `server/schema.sql` is the source of truth for initial setup.

That means the normal setup flow is:

1. Create the MySQL database.
2. Run `server/schema.sql`.
3. Set the environment variables.
4. Start the backend.

## What To Remember About The Connection Design

The database layer is intentionally simple:

- One shared pool for the application
- Direct SQL queries for most endpoints
- Transactions only where consistency matters most

That design is appropriate for a POS system because it keeps the code easy to trace while still protecting sales integrity.
