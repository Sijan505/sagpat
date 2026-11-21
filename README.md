# Sagpat (सगपात)

Fresh-produce shop for Kathmandu Valley, with a staff admin panel.

- **Shop:** http://localhost:3000/
- **Admin:** http://localhost:3000/admin

## Run it

```
npm install
npm run dev
```

`npm run dev` restarts the server when files in `server/` change. Pages, CSS and browser JS only need a browser refresh.
Use another port with `PORT=3001 npm run dev` (PowerShell: `$env:PORT=3001; npm run dev`).

## Customer accounts (Google sign-in)

Customers **must sign in with Google to place an order** (the server rejects orders from anyone not signed in).
They sign in at **My orders** (`/account.html`), or from the checkout page. Signed-in customers get:

- **Order history** with filters (in progress / delivered / cancelled), tracking links and "Buy again".
- **Notifications**: a bell in the header shows "Order placed" right after checkout and every status change staff make
  (confirmed, packed, out for delivery, delivered, cancelled). Customers can also turn on browser alerts.
- Orders placed on the same device before signing in are added to their account automatically.

To turn on Google sign-in:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type *Web application*.
2. Under **Authorized JavaScript origins** add your site, e.g. `http://localhost:3000` and `https://your-domain`.
3. Start the server with the client ID:
   `GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com npm run dev`
   (PowerShell: `$env:GOOGLE_CLIENT_ID="1234-abc.apps.googleusercontent.com"; npm run dev`)

The server checks each Google sign-in token's signature and audience itself (`server/customers.js`).
**Without `GOOGLE_CLIENT_ID` nobody can sign in, so no orders can be placed**; checkout shows the shop's phone number instead.

## Staff logins

On the first run the server creates one account per role, with random passwords, and writes them to
`data/staff-logins.local.txt` (next to the database file). Sign in, change your password under **My account**, then delete that file.
On Vercel no file can be written: sign in as the Super Admin and set the other staff passwords under **Staff accounts**.
The `data/` folder is git-ignored.

| Role | Can do |
|---|---|
| Super Admin | Everything: delete orders, staff accounts, settings, reports, activity log |
| Order Manager | All orders, status changes, deliveries, customer contact, CSV export, order totals. Can't delete orders. |
| Product Manager | Products, categories, stock. No access to orders or sales figures. |
| Delivery Manager | Orders waiting to go out, delivery status, riders, delivery slots. Sees cash to collect, not sales. |

Permissions are checked by the server on every request (`server/permissions.js`); the admin UI only hides what a role can't use.

## Demo data

`npm run seed:demo` adds about 30 days of made-up orders so the dashboard and reports have something to show.
Demo customers' phone numbers start with `980000`.

To start again from scratch, stop the server and delete the `data/` folder. It is recreated (with new staff passwords) on the next start.

## Deploying to Vercel

The project is set up for Vercel (`vercel.json`), and pushes to `main` deploy automatically.

- **Database:** Turso (hosted SQLite), connected through the Vercel Marketplace. It sets `TURSO_DATABASE_URL` and
  `TURSO_AUTH_TOKEN`. Without them (locally) the server uses `data/sagpat.db`.
- **Photo uploads:** Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Locally they go to `images/uploads/`.
- **Super Admin password:** set `SEED_ADMIN_PASSWORD` so the hosted site doesn't use the password written in `server/seed.js`.
  It's used when the database is first created.
- **Google sign-in:** set `GOOGLE_CLIENT_ID`, and add the site's URL to the OAuth client's *Authorized JavaScript origins*.
- `npm run build` copies the public pages, CSS, JS and images into `public/`, which Vercel serves from its CDN.
  Every other request goes to `api/index.js`, which runs the Express app. Server code and data are never served.
- The admin panel's live updates poll for changes every few seconds (no long-lived connections, which serverless can't keep).

## How it fits together

- `server/`: Express API and SQLite database (via `@libsql/client`: a local file, or Turso when deployed)
  - `app.js`: the Express app (run locally by `index.js`, on Vercel by `api/index.js`)
  - `routes/public.js`: the shop's catalog (`/js/data.js` is generated from the database), placing orders, order tracking
  - `routes/admin.js`: the staff API
  - `orders.js`: prices, stock, delivery slots and the order status workflow, all worked out on the server
  - `customers.js`: customer Google sign-in, sessions and order notifications
  - `events.js`: live updates for the admin panel (a change feed it polls)
  - `seed-data.js`: the starting catalog, loaded into the database on first run
- `admin/`: the admin panel (plain HTML/CSS/JS)
- `index.html`, `products.html`, …, `js/`, `css/`: the shop
- `images/`: product photos from Wikimedia Commons (see `credits.html`); uploads go to `images/uploads/` (Vercel Blob when deployed)

## Before going live

- Run behind HTTPS and set `NODE_ENV=production` so the login cookie is marked secure (Vercel does both).
- Back up the database regularly (`data/sagpat.db` locally; Turso has its own backups).
- Replace the placeholder phone, email, bank details and PAN (Admin → Settings, and `confirmation.html` / `checkout.html`).
- Check with an accountant whether 13% VAT applies to your products (Admin → Settings → VAT).
- Khalti and eSewa orders are saved as "payment pending". Connect the real payment flow in `startOnlinePayment()` in `js/checkout.js`, and confirm payments on the server before marking orders paid.
