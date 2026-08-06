# Dexline Store

Single-vendor e-commerce web app for Dexline Technologies. Dexline sources products from 60+ supplier
companies and manages the entire catalog and back office itself — this is not a multi-vendor marketplace.

There is no payment gateway in this phase: customers check out to a pre-filled WhatsApp message, pay via
bank transfer or cash, and an admin manually marks the order **Payment Confirmed** once they've verified it.

## Stack

- **Backend**: Node.js/Express + MongoDB (Mongoose), JWT auth — `backend/`
- **Frontend**: Next.js (App Router) + Tailwind CSS — `frontend/`

## Order status flow

```
Pending Confirmation → Payment Confirmed → Processing → Shipped → Delivered
                    (Cancelled reachable from any state before Shipped)
```

All transitions are admin-driven from the admin panel; there is no automatic payment detection.

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI, JWT_SECRET, WHATSAPP_NUMBER (Dexline's WhatsApp number, digits only, country code first)
npm run seed   # creates an admin user (admin@dexline.store / Admin@123) + sample categories/products
npm run dev    # starts the API on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev    # starts the storefront on http://localhost:3000
```

Log in with `admin@dexline.store` / `Admin@123` (from the seed script) to reach `/admin`. Change this
password immediately in a real deployment — the seed script is for local development only.

## Repo layout

```
backend/     Express API, MongoDB models, JWT auth, admin/customer routes
frontend/    Next.js storefront + admin panel
```

See `backend/README.md` (if present) and `frontend/README.md` for per-app details.
