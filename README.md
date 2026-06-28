# deal-dossier-web

Drop a company domain, get a grounded, meeting-ready deal dossier. A Next.js app whose API route crawls the company's homepage plus `/about` and `/pricing`, then asks Gemini (with Google Search grounding) for live signals and a structured dossier, streamed back to the browser. Past dossiers are saved in the browser via localStorage.

## Local development

1. Copy the env file and add your Gemini key:
   ```bash
   cp .env.example .env.local
   ```
   Set `GENAI_API_KEY` to your key from https://aistudio.google.com/apikey
   Set `MONGODB_URI` to a MongoDB connection string (e.g. an Atlas free cluster). Only needed for shareable links; everything else works without it.
   Set `envo` to `dev` locally; set it to `prod` on your deployment so share links point to your domain (dossier.ayam.codes) instead of the raw host.
2. Install and run:
   ```bash
   npm install
   npm run dev
   ```
3. Open http://localhost:3000

## Deploy free on Vercel

1. Push this folder to a GitHub repo.
2. On vercel.com, "Add New Project" and import the repo.
3. Under Settings > Environment Variables, add `GENAI_API_KEY`, `MONGODB_URI`, and `envo` (set to `prod`).
4. Deploy. The API route runs as a serverless function; the frontend is static.

## Notes

- Models: tries `gemini-3.5-flash`, falls back to `gemini-2.5-flash`, with retry/backoff on transient 503/429.
- The API route streams text; the key stays server-side and never reaches the browser.
- Retry/fallback covers errors before streaming starts; a mid-stream outage shows a truncated dossier rather than auto-retrying.
- The model emits a compact JSON block alongside the prose; the frontend turns it into an interactive signals timeline, priority/pain chips, and value cards. If that block is missing or truncated, graphics are skipped and the prose still renders.
- Share stores a snapshot of the dossier in MongoDB and returns a `/?id=...` link. Opening it reads the stored snapshot, so it costs no model call and never changes.
