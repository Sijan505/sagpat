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

## Staff logins

On the first run the server creates one account per role, with random passwords, and writes them to
`data/staff-logins.local.txt`. Sign in, change your password under **My account**, then delete that file.
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

## How it fits together

- `server/`: Express API and SQLite database (Node's built-in `node:sqlite`, so there are no native add-ons)
  - `routes/public.js`: the shop's catalog (`/js/data.js` is generated from the database), placing orders, order tracking
  - `routes/admin.js`: the staff API
  - `orders.js`: prices, stock, delivery slots and the order status workflow, all worked out on the server
  - `events.js`: live updates to open admin dashboards (Server-Sent Events)
  - `seed-data.js`: the starting catalog, loaded into the database on first run
- `admin/`: the admin panel (plain HTML/CSS/JS)
- `index.html`, `products.html`, …, `js/`, `css/`: the shop
- `images/`: product photos from Wikimedia Commons (see `credits.html`); uploads go to `images/uploads/`

## Before going live

- Run behind HTTPS and set `NODE_ENV=production` so the login cookie is marked secure.
- Back up `data/sagpat.db` regularly.
- Replace the placeholder phone, email, bank details and PAN (Admin → Settings, and `confirmation.html` / `checkout.html`).
- Check with an accountant whether 13% VAT applies to your products (Admin → Settings → VAT).
- Khalti and eSewa orders are saved as "payment pending". Connect the real payment flow in `startOnlinePayment()` in `js/checkout.js`, and confirm payments on the server before marking orders paid.
