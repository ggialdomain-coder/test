# Frontend QA Tool

Frontend QA Tool is a frontend QA automation SaaS MVP that audits a public website URL and generates a visual report for common frontend quality issues.

## What It Does

The app lets a user enter a website URL, run an audit, and review a browser-based report with:

- page metadata checks
- image quality checks
- console error capture
- desktop and mobile viewport checks
- accessibility violations powered by `axe-core`
- screenshots for desktop and mobile
- local audit history
- PDF export of the visible report

## Features

- Audit public URLs through a simple dashboard
- Check page title and meta description
- Detect missing image alt attributes
- Detect broken images
- Capture console errors during load
- Test desktop and mobile viewport loading
- Run accessibility checks with `axe-core`
- Generate an overall score and status band
- Save desktop and mobile screenshots
- Export the report as a PDF
- Store the latest 10 audits in browser `localStorage`

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Playwright
- axe-core
- jsPDF
- html2canvas

## Installation

1. Clone the repository.
2. Move into the project folder.
3. Install dependencies:

```bash
npm install
```

## Run Locally

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Run with Separate Audit Backend

The frontend now supports calling an external audit service. This is the recommended setup for hosted deployments where Playwright cannot run reliably inside the frontend platform.

1. Copy `.env.example` to `.env.local`
2. Set:

```bash
NEXT_PUBLIC_AUDIT_API_BASE_URL=http://localhost:8787
```

3. Start the standalone audit backend:

```bash
npm run audit:server
```

4. In a second terminal, start the frontend:

```bash
npm run dev
```

## Playwright Browser Install

Playwright needs a browser installed for local audits.

Run:

```bash
npx playwright install chromium
```

## Standalone Audit Backend

This repo includes a standalone backend server at:

- `audit-backend/server.mjs`

It exposes:

- `POST /api/audit`
- `GET /health`

This backend is intended for:

- local development with the Netlify frontend
- deployment to a separate Node-friendly host such as Render, Railway, Fly.io, or a VPS

## Deploy to Netlify

This repo is prepared for Netlify with:

- `netlify.toml`
- production build verified with `npm run build`
- Next.js App Router compatible setup
- Netlify-safe screenshot handling for deployed audits

Important:

- Netlify is suitable for the frontend
- real browser auditing should be moved to the standalone backend for a working hosted setup
- the frontend can use `NEXT_PUBLIC_AUDIT_API_BASE_URL` to call that separate backend

Basic deploy flow:

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. Create a new site in Netlify.
3. Import the repository.
4. Netlify should detect Next.js automatically.
5. Use the default build command:

```bash
npm run build
```

6. Deploy the site.

## Project Structure

Key folders:

- `src/app` - app routes and API routes
- `src/components` - UI components
- `src/lib` - shared logic such as score calculation
- `src/types` - shared TypeScript types
- `public/audit-screenshots` - generated audit screenshots during local development

## How the MVP Works

1. Enter a public website URL.
2. Submit the audit form.
3. The backend launches Playwright Chromium.
4. The app audits the page in desktop and mobile viewports.
5. The report is rendered in the dashboard, saved locally in history, and can be exported as a PDF.

## Known Limitations

- Designed for public URLs only
- No authentication or team accounts yet
- No database persistence yet; audit history is stored only in browser `localStorage`
- Screenshot files are stored locally in `public/audit-screenshots`
- Full hosted browser auditing requires a separate backend runtime outside Netlify
- Accessibility checks currently use the primary audited page response
- PDF export captures the visible report area from the browser, so output can vary slightly by screen and browser rendering
- Long or highly dynamic pages may take longer to audit or export
- No background job queue yet; audits run within the request lifecycle

## Future Roadmap

- user authentication
- persistent report storage in a database
- background audit jobs and queue processing
- shareable report links
- team dashboards
- recurring scheduled audits
- more SEO checks
- richer accessibility summaries and grouping
- performance and Core Web Vitals checks
- downloadable branded PDF reports
- CSV and JSON export
- domain/project management

## Development Notes

If you install dependencies on a fresh machine, the usual local setup flow is:

```bash
npm install
npx playwright install chromium
npm run dev
```
