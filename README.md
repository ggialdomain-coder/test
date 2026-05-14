# Frontend QA Tool

Frontend QA Tool is a hosted-safe frontend QA automation SaaS MVP that audits a public website URL and generates a visual report for common frontend quality issues.

## What It Does

The app lets a user enter a website URL, run an audit, and review a hosted-safe report with:

- page metadata checks
- image quality checks
- desktop and mobile reachability checks
- local audit history
- PDF export of the visible report

## Features

- Audit public URLs through a simple dashboard
- Check page title and meta description
- Detect missing image alt attributes
- Detect broken images
- Test desktop and mobile website reachability
- Generate an overall score and status band
- Export the report as a PDF
- Store the latest 10 audits in browser `localStorage`

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
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

## Deploy to Netlify

This repo is prepared for Netlify with:

- `netlify.toml`
- production build verified with `npm run build`
- Next.js App Router compatible setup
- a hosted-safe audit route that avoids browser automation on the server

Important:

- the current MVP is designed to run directly on standard hosting
- it uses server-side HTML fetching and asset validation instead of browser automation
- browser-powered checks can be added later behind a separate worker or premium backend

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
- `public` - static assets

## How the MVP Works

1. Enter a public website URL.
2. Submit the audit form.
3. The server fetches the page HTML for desktop and mobile-style requests.
4. The app checks metadata, image alt coverage, image reachability, and response health.
5. The report is rendered in the dashboard, saved locally in history, and can be exported as a PDF.

## Known Limitations

- Designed for public URLs only
- No authentication or team accounts yet
- No database persistence yet; audit history is stored only in browser `localStorage`
- Console capture, screenshots, and automated accessibility scans are not part of the hosted-safe MVP yet
- Responsive checks currently validate reachability rather than full rendered layout behavior
- PDF export captures the visible report area from the browser, so output can vary slightly by screen and browser rendering
- Some image-heavy pages may take longer because the API verifies a limited set of image assets per run
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
- browser-powered console capture and screenshots
- automated accessibility scanning
- performance and Core Web Vitals checks
- downloadable branded PDF reports
- CSV and JSON export
- domain/project management

## Development Notes

If you install dependencies on a fresh machine, the usual local setup flow is:

```bash
npm install
npm run dev
```
