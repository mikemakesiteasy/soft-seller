# Soft Sell

Mobile-first field app for Soft Water Specialists (Next.js PWA + Supabase).

## Run
    cp .env.example .env.local   # add your Supabase URL and publishable key
    npm install
    npm run dev

Business rules and placeholder prices live in `lib/data.ts`; screens in `app/App.tsx`.
Database: Supabase project `sws-field-app` (multi-company, row-level security).
