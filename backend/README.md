# Dexline Store — Backend API

Express + MongoDB (Mongoose) API for Dexline Store, with JWT auth for customers and admins.

## Setup

```bash
npm install
cp .env.example .env
# set MONGO_URI, JWT_SECRET, WHATSAPP_NUMBER (digits only, country code first, e.g. 91XXXXXXXXXX)
npm run seed   # optional: creates an admin user + sample categories/products
npm run dev
```

API runs on `http://localhost:5000` by default; all routes are under `/api`.

## Key routes

| Area       | Route                                   | Notes                                  |
|------------|------------------------------------------|-----------------------------------------|
| Auth       | `POST /api/auth/register`, `/login`, `GET/PUT /api/auth/me` | JWT in `Authorization: Bearer` header |
| Catalog    | `GET /api/categories`, `GET /api/products`, `GET /api/products/slug/:slug` | Public |
| Cart       | `GET/POST/PUT/DELETE /api/cart...`      | Requires login |
| Orders     | `POST /api/orders`, `GET /api/orders/mine` | Requires login; create returns a `whatsappLink` |
| Admin      | `/api/products/admin/*`, `/api/categories/all`, `/api/orders/admin/*`, `/api/admin/dashboard` | Requires `role: admin` |
| Uploads    | `POST /api/uploads` (multipart, field name `images`, up to 6 files, 5MB each) | Requires `role: admin`; returns `{ urls: [...] }` |

Uploaded files are stored on local disk under `backend/uploads/` (gitignored) and served statically at
`/uploads/<filename>`. This is fine for local dev and single-server deployments; for a multi-server or
serverless deployment, swap `src/middleware/upload.js` for a cloud storage backend (S3, Cloudinary, etc.)
without needing to change the route or frontend contract — it only cares about the returned `urls`.

## Order status flow

`Pending Confirmation → Payment Confirmed → Processing → Shipped → Delivered`, with `Cancelled` reachable
from any state before `Shipped`. Enforced server-side in `src/controllers/orderController.js`. Placing an
order decrements product stock; cancelling restores it.

## Data models

See `src/models/` — `User`, `Category`, `Product`, `Cart`, `Order`.
