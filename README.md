# AutoMate

> AI workflow automation — describe an automation in plain English, AutoMate builds it and runs it across your connected accounts (Gmail, Drive, Slack, Notion, Calendar).

![Next.js](https://img.shields.io/badge/Next.js-000?logo=next.js)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=fff)
![Claude](https://img.shields.io/badge/Claude%20Sonnet%204.6-D97757)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?logo=stripe&logoColor=fff)

## Tech stack

- **Next.js** (App Router) + TypeScript strict + Tailwind v4 + shadcn/ui
- **Auth.js v5** (`next-auth@beta`) — Resend magic link + Google OAuth
- **MongoDB Atlas + Mongoose**
- **Upstash QStash** for queue / scheduling
- **OpenRouter → Claude Sonnet 4.6** for the AI workflow builder + `ai.transform` steps
- **Arctic** for integration OAuth (Slack, Notion)
- **AES-256-GCM** for encrypting stored OAuth tokens
- **Stripe** (metered billing) · **Resend** (email)
- Self-hosted error tracking (Mongoose `ErrorLog` model)
- Deployed on **Vercel**

## Local setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment template and fill values as each phase requires
cp .env.example .env.local

# 3. Start the dev server
pnpm dev
```

Then open <http://localhost:3000>.

## Architecture

_Diagram coming in Phase 12._

## Scripts

| Command       | What it does                |
| ------------- | --------------------------- |
| `pnpm dev`    | Start the Next.js dev server |
| `pnpm build`  | Production build            |
| `pnpm start`  | Run the production build    |
| `pnpm lint`   | ESLint                      |
