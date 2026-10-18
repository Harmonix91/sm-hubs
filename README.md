# sm-hubs

Members' hubs site for Sonder & Metric (HR, Operating Partners, CFO, CEO, Investors) plus the private admin approval queue at `/admin/`.

- Hosting: GitHub Pages (static).
- Data and sign-in: Supabase project `sonder-metric-intelligence`. The key in the pages is the public key; all data is protected by row-level security. Only emails in the `admins` table can see or decide drafts.
- Never commit secrets (service-role keys, Kit API secret) to this repo. Server-side work runs as Supabase Edge Functions.
