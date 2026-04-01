# Paystack Integration in SmartPOS

This document explains the Paystack flow implemented in SmartPOS from the cashier choosing mobile money at checkout all the way to the sale being saved in the database.

The important point is that Paystack is not just a payment button in this app. It is part of a guarded workflow:

1. The cashier starts a POS checkout.
2. If the payment method is Mobile Money, the frontend sends the payment request to the backend.
3. The backend talks to Paystack using the secret key.
4. The frontend keeps checking the payment reference until Paystack reports `SUCCESS` or `FAILED`.
5. Only after success does the app create the sale record and reduce stock.

This means the payment is used as a gate before the sale is persisted.

## Where The Paystack Flow Lives

- Frontend checkout logic: [pos-system/js/pos.js](pos-system/js/pos.js)
- Frontend API wrapper: [pos-system/js/api.js](pos-system/js/api.js)
- POS checkout UI: [pos-system/pos.html](pos-system/pos.html)
- Backend Paystack routes and helpers: [server/server.js](server/server.js)
- Payment-related database fields: [server/schema.sql](server/schema.sql)
- Existing overview notes: [README.md](README.md)

## User-Facing Checkout Flow

The cashier sees `Cash` and `Mobile Money (Paystack)` in the POS payment selector in [pos-system/pos.html](pos-system/pos.html). When `Mobile Money (Paystack)` is selected, two extra fields appear:

- Mobile network
- Payer email
- Payer number

The checkout handler in [pos-system/js/pos.js](pos-system/js/pos.js) treats this branch differently from a cash sale. It still calculates subtotal, discount, and total the same way, but it does not immediately create the sale if the payment is mobile money.

The mobile money branch requires:

- A payer number
- A valid payer email
- A selected mobile money network

If any of those are missing, checkout stops before any Paystack call happens.

## Frontend-to-Backend Payment Sequence

When the cashier clicks Checkout on a mobile money sale, the frontend does the following:

1. It calculates the basket total from the cart contents.
2. It builds a temporary merchant reference using `buildRequestRef()`.
3. It calls `API.initiatePaystackPayment(...)` in [pos-system/js/api.js](pos-system/js/api.js).
4. The backend sends the request to Paystack.
5. The frontend opens the returned Paystack authorization URL in a new tab or redirects in the same tab if popups are blocked.
6. The frontend starts polling Paystack verification through the backend.
7. If Paystack eventually reports success, the sale is written to the database.

The important design choice here is that the frontend never trusts its own local state alone. It waits for server-side verification before posting the final sale.

## Request Sent To The Backend

The frontend sends the following data to `POST /api/payments/paystack/initiate`:

- `amount`: the final checkout total after discount
- `customerMsisdn`: the payer number
- `customerEmail`: the payer email
- `customerName`: customer name or `Walk-in Customer`
- `channel`: selected mobile network such as `mtn-gh` or `vodafone-gh`
- `description`: a short checkout description
- `callbackUrl`: the current POS page URL
- `externalReference`: a merchant-generated reference

That request is created in [pos-system/js/pos.js](pos-system/js/pos.js) and sent by [pos-system/js/api.js](pos-system/js/api.js).

## Backend Initialization Behavior

The backend handler in [server/server.js](server/server.js) validates the request before talking to Paystack.

It checks:

- Amount must be greater than zero.
- Customer mobile number must be present.
- Customer email must be present and contain `@`.
- Channel must be one of the allowed Ghana mobile money channels.

The allowed channels are:

- `mtn-gh`
- `tgo-gh`
- `vodafone-gh`
- `airteltigo-gh`

After validation, the backend builds the Paystack payload.

### Paystack payload fields used by the app

The backend sends the following to Paystack:

- `email`: payer email
- `amount`: converted into the smallest currency unit by multiplying by 100 and rounding
- `currency`: `GHS`
- `reference`: the merchant reference, or a generated fallback reference
- `channels`: `['mobile_money']`
- `callback_url`: optional, if present and safe
- `metadata`: custom data describing the customer and checkout

The metadata includes:

- `customer_name`
- `customer_msisdn`
- `channel`
- `description`

This metadata is not just decorative. It gives the payment provider and the app enough context to trace the transaction later.

## Secret Key And Paystack URLs

The backend reads these environment variables in [server/server.js](server/server.js):

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_INITIATE_URL`
- `PAYSTACK_VERIFY_URL_TEMPLATE`
- `PAYSTACK_CALLBACK_URL`

Defaults used by the code are:

- `PAYSTACK_INITIATE_URL = https://api.paystack.co/transaction/initialize`
- `PAYSTACK_VERIFY_URL_TEMPLATE = https://api.paystack.co/transaction/verify/{reference}`

The backend refuses to continue if the secret key is missing, because the Paystack API calls are authenticated server-to-server.

## Why The Backend Exists In The Middle

The app does not call Paystack directly from the browser with the secret key. That would expose sensitive credentials to the client.

Instead, the backend:

- Keeps the secret key private
- Normalizes the request before it reaches Paystack
- Normalizes Paystack’s response into `SUCCESS`, `FAILED`, or `PENDING`
- Gives the frontend a single backend API that is easier to control and secure

This is the correct boundary for a payment integration.

## Authorization URL And Popup Fallback

If Paystack returns an `authorization_url`, the frontend opens it in a new tab.

If the browser blocks the popup, the code falls back to a same-tab redirect.

That matters because mobile browsers often block popups more aggressively than desktop browsers. The app has a dedicated reliability fix for that case.

## Verification Model

The app does not rely on a webhook handler for the payment decision. Instead, it polls verification using the Paystack reference.

The polling loop is in [pos-system/js/pos.js](pos-system/js/pos.js):

- It checks the status every 3 seconds.
- It keeps checking up to 240 times.
- That gives a maximum wait window of roughly 12 minutes.

The verification request goes to `GET /api/payments/paystack/status/:reference` on the backend, which in turn calls the Paystack verify endpoint.

## Status Normalization

Paystack responses are normalized by the backend into three states:

- `SUCCESS`
- `FAILED`
- `PENDING`

The backend treats raw Paystack values such as `success`, `successful`, `paid`, and `completed` as success.

It treats raw values such as `failed`, `abandoned`, `cancelled`, `canceled`, `reversed`, `declined`, and `error` as failure.

Everything else stays pending.

This normalization is important because the frontend logic only needs a small set of business states.

## What Happens After Success

Once verification returns `SUCCESS`, the frontend posts the sale to `POST /api/sales`.

The sale payload includes:

- cashier username
- customer id or null
- customer name or null
- subtotal
- discount
- total
- payment method
- cash received field
- payer number
- provider set to `Paystack`
- provider reference
- payment status set to `SUCCESS`
- cart items
- request reference

Only after that request succeeds does the app show the final receipt and reset the checkout state.

## Sale Persistence Rules On The Backend

The backend sale route enforces several Paystack-specific rules before it writes anything.

For `Mobile Money` sales it requires:

- `payerNumber`
- `provider === 'Paystack'`
- `providerReference`
- `paymentStatus === 'SUCCESS'`

If any of those are missing or wrong, the sale is rejected.

This is the main server-side protection against recording an unpaid mobile money sale.

## Database Records Created For A Successful Payment

When the mobile money payment is accepted, the backend writes across multiple tables:

- A row in `sales`
- A row per basket item in `sales_items`
- A row in `payments`
- Inventory deductions in `products`
- Inventory audit rows in `inventory_log`
- Loyalty points for the customer if a customer was selected

The payment row stores these Paystack-specific fields:

- `provider`
- `provider_reference`
- `payment_status`
- `payer_number`

That is what lets the app later reconstruct how the payment happened.

## Duplicate Submission Protection

The app has two layers of protection against accidentally recording the same mobile money checkout twice.

1. The frontend stores the pending Paystack checkout in `sessionStorage` under `smartpos.pendingPaystackCheckout`.
2. The backend caches completed sale responses by `requestRef` for 15 minutes.

If the browser refreshes mid-checkout, the app can resume by reading the stored Paystack reference and checking verification again.

If the same `requestRef` reaches the sale endpoint again, the backend can return the cached response instead of inserting another sale.

## Resume After Refresh Or Temporary Failure

The frontend starts a watcher on page load.

That watcher does two things:

- It periodically re-checks pending Paystack checkouts.
- It re-checks immediately when the tab becomes visible again or regains focus.

This is a practical workaround for browser throttling and user refreshes.

If the payment has already been confirmed, the app resumes by creating the sale from the saved payload.

If verification reports `FAILED`, the app clears the pending record and does not create a sale.

## Callback URL Handling

The frontend sends a callback URL based on the current POS page location.

The backend sanitizes that URL before forwarding it to Paystack.

It only accepts safe `http` or `https` URLs.

If the request does not provide a usable callback URL, the backend falls back to `PAYSTACK_CALLBACK_URL`.

That gives the deployment an optional server-defined fallback without trusting arbitrary strings.

## What This Implementation Is Not Doing

This app is not using a webhook-based payment completion flow.

It is also not using Paystack for card payments in this checkout path.

The current implementation is specifically the mobile money path labeled `Mobile Money (Paystack)` in the POS UI.

## End-To-End Summary

In plain terms, the Paystack implementation works like this:

1. The cashier chooses mobile money at checkout.
2. The frontend validates the payer details.
3. The frontend asks the backend to create a Paystack transaction.
4. The backend sends a protected server-to-server request to Paystack.
5. The frontend opens Paystack’s authorization page.
6. The frontend keeps polling the backend for verification.
7. The backend checks Paystack with the payment reference and normalizes the result.
8. When the result becomes `SUCCESS`, the frontend submits the sale.
9. The backend writes the sale, items, payment, stock changes, and loyalty points.

That is the actual trust chain in the app.
