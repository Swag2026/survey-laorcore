# OUTFIT Survey — React

React + Vite version of the OUTFIT customer survey and its admin report.
Same backend (`survey-api.swag.sa`), same design — now with proper routing:

- `/` — the customer survey (4 steps, same questions and coupon reveal)
- `/admin` — the results dashboard (charts, filters, CSV/PDF export)

## Run locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. `/admin` works the same as `/`.

## Build

```bash
npm run build
```

Outputs static files to `dist/`. This is a client-side SPA — `/admin` is
not a real file on disk, it's a route handled by `react-router-dom` in the
browser. Any host serving this needs to fall back to `index.html` for
unknown paths (see below), or a hard refresh on `/admin` will 404.

## Deploy — Vercel (same pattern as your other frontends)

1. Push this folder to a GitHub repo, or drag-and-drop the `dist/` folder
   at https://vercel.com/new after running `npm run build` locally.
2. `vercel.json` is already included with the rewrite rule Vercel needs
   for client-side routing — no extra config required.
3. Once deployed, `https://<your-project>.vercel.app/admin` will work
   directly, including on refresh and when shared as a link.

If you later point a custom domain (e.g. `survey.laroche.sa`) at this
Vercel project, `/admin` becomes `https://survey.laroche.sa/admin`.

## Deploy — same VM (Docker + Cloudflare Tunnel), if you'd rather not use Vercel

```dockerfile
# Dockerfile (add this file if you go this route)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

```nginx
# nginx.conf
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;   # SPA fallback — this is the important line
  }
}
```

Then the same `docker compose` + Cloudflare Tunnel hostname pattern you
used for the backend (e.g. `survey.swag.sa` → `localhost:<port>`).

## Config

`src/lib/config.js` holds the backend URL and discount code:

```js
export const API_BASE = "https://survey-api.swag.sa";
export const DISCOUNT_CODE = "outfit15";
```

Change these here if the backend URL or code ever changes — nothing else
in the app needs touching.
