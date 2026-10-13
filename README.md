# Sky Holidays dashboard

The staff dashboard (Next.js 16, React 19) for running Sky Holidays: bookings, enquiries,
payments, documents, the catalogue (hotels, excursions, packages, Umrah, transfers, car rental,
destinations, visas), the website's homepage, media, users and roles, and settings.
It has no database of its own: everything is read and saved through the Sky Holidays API.

## Run it

```bash
cp .env.example .env     # API_URL and NEXT_PUBLIC_WEBSITE_URL
npm install
npm run dev              # http://localhost:3001/admin
```

Start the API first (see the `api` package) and create the Owner account there with
`npm run db:setup`. Sign in with that email and password.
Production: `npm run build && npm start`, ideally on its own address such as admin.skyholidays.pk
and served over HTTPS (the sign-in cookie is secure-only in production).

## Layout

- `src/app/admin/`: pages. Each section's sub-tabs are routes (`/admin/bookings/cancelled`).
- `src/admin/`: shared pieces (`api.ts` client, `ui.tsx` kit, `shell.tsx` rail and permissions)
  and one folder per area (`ops`, `catalog`, `services`, `docs`, `admin-area`).
- `src/shared/admin-nav.ts`: sections, sub-tabs and permission keys. **Keep it identical to
  `shared/admin-nav.js` in sky-api**, which checks the same keys.
