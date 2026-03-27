# Chatbot Interface

A full-stack ChatGPT clone built with Next.js 14 (App Router), Supabase, and OpenAI. Features real-time streaming responses, image and document attachments, anonymous guest access, and cross-tab synchronization.

Built as a demonstration of clean architecture, proper REST semantics, and polished UX.

## Features

- **Authentication** — Email/password signup and login via Supabase Auth, with httpOnly cookie sessions
- **Chat CRUD** — Create, rename, and delete conversations with cascading cleanup
- **Streaming responses** — Real-time token-by-token rendering via Server-Sent Events (SSE)
- **Image attachments** — Paste or upload images (PNG, JPEG, GIF, WebP) with OpenAI Vision support
- **Document upload** — Upload PDF, TXT, or Markdown files; extracted text is injected as LLM context
- **Anonymous access** — Try the chatbot without signing up (3 free questions, tracked in localStorage)
- **Cross-tab sync** — Chat list stays in sync across browser tabs via BroadcastChannel (polling fallback)
- **Markdown rendering** — Assistant messages rendered with syntax-highlighted code blocks, lists, and headings
- **Responsive UI** — Collapsible sidebar on mobile, persistent on desktop, skeleton loaders throughout

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (email/password) |
| AI | OpenAI GPT-4o / Vision |
| UI | Shadcn UI + Tailwind CSS |
| Data Fetching | TanStack Query v5 |
| Validation | Zod |
| Testing | Vitest + fast-check |

## Prerequisites

- [Node.js](https://nodejs.org/) v18+ and npm
- A [Supabase](https://supabase.com) project (free tier works)
- An [OpenAI API key](https://platform.openai.com/api-keys) with credits
- (Optional) [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) + [Docker](https://www.docker.com/) for local development

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd chatbot-interface
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with the following variables:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side service role key | Supabase Dashboard → Settings → API → `service_role` (click Reveal) |
| `SUPABASE_ANON_KEY` | Public anonymous key | Supabase Dashboard → Settings → API → `anon` `public` |
| `OPENAI_API_KEY` | OpenAI API key | [OpenAI Dashboard → API Keys](https://platform.openai.com/api-keys) |
| `NEXT_PUBLIC_SUPABASE_URL` | Client-side Supabase URL (public) | Same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side anon key (public) | Same as `SUPABASE_ANON_KEY` |

### 3. Set up Supabase database

#### Option A: Cloud Supabase (recommended)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor in the dashboard
3. Paste the contents of `supabase/migrations/001_initial_schema.sql` and click Run
4. Go to Storage and verify the `chat-images` and `chat-documents` buckets were created (the migration creates them automatically)

#### Option B: Local Supabase (requires Docker)

```bash
supabase start
supabase db reset
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Auth pages (login, signup)
│   ├── (chat)/              # Chat pages (chat list, individual chat)
│   ├── api/                 # REST API route handlers
│   │   ├── auth/            #   signup, login, logout, me, refresh
│   │   ├── chats/           #   CRUD + messages + documents
│   │   └── uploads/         #   image upload
│   ├── layout.tsx           # Root layout with providers
│   └── page.tsx             # Landing page / redirect
├── components/
│   ├── auth/                # Login and signup forms
│   ├── chat/                # Chat list, messages, input, attachments
│   ├── layout/              # Sidebar, chat header
│   ├── shared/              # Empty state, skeleton loader, error boundary
│   └── ui/                  # Shadcn UI primitives
├── hooks/                   # TanStack Query hooks, auth, anonymous, cross-tab sync
├── lib/
│   ├── supabase/admin.ts    # Supabase admin client (service role key)
│   ├── openai/client.ts     # OpenAI client instance
│   ├── auth-helpers.ts      # Request authentication helper
│   ├── constants.ts         # App-wide constants
│   ├── query-keys.ts        # TanStack Query key factory
│   └── utils.ts             # Shared utilities
├── services/                # Server-side business logic
│   ├── auth.service.ts      # Supabase Auth admin operations
│   ├── chat.service.ts      # Chat CRUD, ownership validation
│   ├── message.service.ts   # Message storage, context assembly
│   ├── llm.service.ts       # OpenAI streaming, prompt construction
│   ├── document.service.ts  # Document upload, text extraction
│   └── upload.service.ts    # Image upload to Supabase Storage
├── types/                   # TypeScript type definitions
│   ├── api.ts               # Request/response types
│   ├── chat.ts              # Domain types
│   └── database.ts          # DB row types and enums
├── providers/               # React context providers (TanStack Query)
├── middleware.ts             # Auth cookie validation middleware
└── __tests__/               # Unit and property-based tests
supabase/
├── config.toml              # Supabase CLI configuration
└── migrations/
    └── 001_initial_schema.sql  # Full database schema
```

## Architecture

The application enforces a strict three-layer separation:

```
React Client  →  Next.js API Routes  →  Supabase (PostgreSQL)
```

- **Client layer** — React components fetch data exclusively through API routes using TanStack Query. No component (including Server Components) makes direct database calls.
- **API layer** — Next.js route handlers contain all server-side logic. They validate requests, authenticate sessions, orchestrate service calls, and return responses. The Supabase service role key lives here — never exposed to the client.
- **Data layer** — PostgreSQL accessed through the Supabase admin client. All queries go through the service layer. No RLS — security is enforced at the API layer.

### Key patterns

- **Service injection** — API routes create a Supabase admin client per request and pass it to service functions. Services never import the client directly.
- **SSE streaming** — Message responses use the Web Streams API (`ReadableStream`) to pipe OpenAI tokens to the client as Server-Sent Events.
- **Optimistic updates** — TanStack Query mutations update the cache immediately, with invalidation on completion.
- **Cross-tab sync** — BroadcastChannel posts mutation events (`chat:created`, `chat:deleted`, `chat:renamed`) to keep all tabs in sync, with a 30-second polling fallback.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `supabase start` | Start local Supabase services |
| `supabase db reset` | Reset database and apply migrations |

## License

This project was built as a job application exercise.
