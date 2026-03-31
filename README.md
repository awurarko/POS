# SmartPOS

SmartPOS is a web-based point-of-sale system with:
- Frontend app in `pos-system/`
- Node.js + Express API in `server/`
- MySQL database schema in `server/schema.sql`

## Features
- Login and first-admin setup
- Role-based access (Admin, Manager, Cashier)
- Products, customers, inventory, sales, reports
- Loyalty points and receipt generation

## Security Baseline
- Password hashing on server with bcrypt
- JWT authentication for protected APIs
- Server-side role checks (RBAC)
- Authentication rate limiting
- Input validation on critical endpoints

## Prerequisites
- Node.js 18+
- MySQL 8+

## Setup
1. Create database schema:
   - Run `server/schema.sql` in MySQL.
2. Configure environment file:
   - Edit `server/env.env` values as needed.
3. Install backend dependencies:
   - From `server/`, run `npm install`.
4. Start backend:
   - From `server/`, run `npm start`.
5. Open app:
   - Visit `http://localhost:3001`.

## Keep Localhost And Deployed Data The Same
By default, localhost uses your local backend/database and deployed uses its own backend/database, so data will differ.

If you want one shared dataset, point localhost frontend to your deployed API:
1. Open localhost with your API override query once:
   - `http://localhost:3001/index.html?apiBase=https://YOUR_DEPLOYED_DOMAIN/api`
2. In browser console, enable remote API usage on localhost:
   - `localStorage.setItem("smartpos.allowRemoteOnLocalhost", "true")`
3. Refresh and log in again.

To switch back to local data later:
- `localStorage.removeItem("smartpos.allowRemoteOnLocalhost")`
- `localStorage.removeItem("smartpos.apiBase")`
- Refresh.

## Environment Variables (`server/env.env`)
- `DB_HOST`
- `DB_PORT` (optional, default 3306)
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `PORT` (default 3001)
- `JWT_SECRET` (required for production)
- `JWT_EXPIRES_IN` (default `8h`)
- `ALLOWED_ORIGINS` (comma-separated, recommended in production)
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_INITIATE_URL` (default `https://api.paystack.co/transaction/initialize`)
- `PAYSTACK_VERIFY_URL_TEMPLATE` (must include `{reference}` placeholder)
- `PAYSTACK_CALLBACK_URL` (optional)

## Paystack Mobile Money Flow
1. Cashier selects `Mobile Money` at checkout.
2. App initializes payment with Paystack using payer email and mobile number metadata.
3. Paystack authorization page opens for customer approval.
4. App polls Paystack verification until success/failure/timeout.
5. Sale is recorded only when Paystack status is `SUCCESS`.

Example verify template:
- `PAYSTACK_VERIFY_URL_TEMPLATE=https://api.paystack.co/transaction/verify/{reference}`

## Production Notes
- Set a strong random `JWT_SECRET`.
- Use HTTPS.
- Restrict `ALLOWED_ORIGINS` explicitly.
- Put API behind a reverse proxy.
- Add backups and database migration workflow.

## Current Limitations
- Paystack mobile money availability depends on your account country and enabled payment channels.
- Content-Security-Policy is currently relaxed due to inline scripts in HTML pages.

