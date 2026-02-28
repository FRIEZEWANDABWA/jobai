# 🚀 Deployment & Setup Guide

This guide covers how to deploy the **AI Executive Job Intelligence System**.

## 1. Supabase Setup (Database & Auth)
1. Go to [Supabase](https://supabase.com) and create a new project.
2. Navigate to the **SQL Editor**.
3. Copy the contents of `supabase/schema.sql` and run it to create the required tables, triggers, and Row Level Security (RLS) policies.
4. Navigate to **Project Settings > API**.
5. Copy the **Project URL**, **anon key**, and **service_role key**.

## 2. API Keys Configuration
You need to acquire the following keys (primarily free tiers):
- **OpenAI**: Create an account on OpenAI and generate an API key (used for `text-embedding-ada-002`).
- **Resend**: Go to [Resend](https://resend.com) and generate an API key for email notifications.
- **Telegram (Optional)**: Message `@BotFather` on Telegram, create a new bot to get the `TELEGRAM_BOT_TOKEN`. Then message `@userinfobot` to get your `TELEGRAM_CHAT_ID`.
- **Cron Secret**: Generate a secure random string (e.g., using `openssl rand -hex 32`) to act as your `CRON_SECRET`. This prevents unauthorized external calls to your scraper endpoints.

## 3. Local Development
1. Rename `.env.example` to `.env.local` and fill in all the values obtained above.
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. Visit `http://localhost:3000/admin` to add sources and configure thresholds.

## 4. Vercel Deployment (Frontend & API)
1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com) and import the repository.
3. Overwrite the Build Command if necessary (default `npm run build` is fine).
4. **Environment Variables**: Add all the variables from your `.env.local` exactly as they appear in the Vercel dashboard settings under Environment Variables.
5. Click **Deploy**.

## 5. GitHub Actions Setup (Scheduler Engine)
The Next.js API endpoints are serverless, but they need to be triggered hourly to scrape jobs and run the matching engine. We use GitHub Actions.
1. In your GitHub repository, navigate to **Settings > Secrets and variables > Actions**.
2. Create two **New repository secrets**:
   - `CRON_SECRET`: Set it to the identical secret used in Vercel.
   - `PRODUCTION_URL`: Set it to your live Vercel domain (e.g., `https://my-job-ai.vercel.app`).
3. The `.github/workflows/job-scraper.yml` file is already configured. It will automatically run every hour, trigger `/api/cron/ingest`, and then `/api/cron/match`.

---
**Initial Data Bootstrapping**
Remember to hit the `/api/admin/cv` route (e.g., via Postman or creating a quick UI script) to upload your CV text so it gets embedded. Until your `cv_embedding` exists in the `user_profiles` table, the match engine will naturally skip processing.
