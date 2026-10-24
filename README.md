# Librat Tanë 📚

A home-library catalog for phones. Type part of a title or author and the app
tells you exactly where the book is: **Rafti 3 · Vendi 5** (shelf 3, position 5).

- Search ignores capitals and accents (`ceshtja` finds *Çështja*), and matches partial words.
- **Photograph a whole shelf** and the AI (Gemini or Groq, both free — or Claude) reads every spine left to right, numbering the positions for you —
  the fast way to catalogue 100+ books (a few photos instead of typing each book).
- Or add a single book by hand / by photographing its cover.
- Filters: Të gjitha / Lexuar / Pa lexuar, and a "Sipas rafteve" (by shelf) view.
- One shared catalog for every device, protected by a single shared passcode (no accounts).
- Large text and buttons, light and dark mode, all UI in Albanian.

Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres) · Gemini / Groq / Claude (vision) · Vercel.

---

## 1. Create the Supabase table

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste this and click **Run**:

```sql
create table public.books (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  author      text not null default '',
  shelf       text not null,
  position    integer not null default 1,
  is_read     boolean not null default false,
  is_sample   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index books_shelf_position_idx on public.books (shelf, position);

-- Lock the table: with RLS on and no policies, the public "anon" key can read nothing.
-- The app only talks to Supabase from the server, using the service-role key.
alter table public.books enable row level security;
```

Then run this second part (shelf photos, "Ku është?" and the bookcase map). It only adds things,
so it is also the upgrade for a catalog created with the first part alone:

```sql
-- Where each book stands on its shelf photo (0–1000 of the photo width)
alter table public.books
  add column if not exists photo_path text,
  add column if not exists x0 smallint,
  add column if not exists x1 smallint;

-- Small key/value settings: the bookcase photo and where each shelf is on it
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

-- Private bucket for shelf and bookcase photos (the server hands out short-lived links)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;
```

3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret; it never reaches the browser)

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

| Variable | What it is |
| --- | --- |
| `APP_PASSCODE` | The shared code the family types once on each phone (e.g. a 4–6 digit number). |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-side only). |
| `GEMINI_API_KEY` | **Free**, recommended photo reading (reads small spine print best). From [aistudio.google.com](https://aistudio.google.com) → Get API key. |
| `GEMINI_MODEL` | Optional. Default `gemini-3.8-flash`. |
| `GROQ_API_KEY` | Free alternative ([console.groq.com](https://console.groq.com) → API Keys). Finds books well but misreads more titles. |
| `GROQ_MODEL` | Optional. Groq vision model, default `qwen/qwen3.8-27b`. |
| `ANTHROPIC_API_KEY` | Optional, paid alternative (Claude). |

Photo reading uses the first of Gemini, Groq, Claude that has a key. Without any, everything works except the photo buttons.
Free tiers have rate limits (Groq: about one shelf photo a minute); when one is hit the app waits and retries by itself.

If `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are missing **in development**, the app falls back to an
in-memory catalog (lost on restart) so you can try it without a database. In production they are required.

## 3. Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, type the passcode, and tap **Shto 10 libra shembull** to try it with
example books. Remove them any time with **Hiq librat shembull** — your own books are never touched.

## 4. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New → Project**, import the repository (framework is detected automatically).
3. Under **Environment Variables**, add `APP_PASSCODE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` (or `GROQ_API_KEY`).
4. Click **Deploy**. Open the URL on each phone, and use the browser's **Add to Home Screen** so it opens like an app.

## Cataloguing a big library quickly

Nobody has to count or remember shelf numbers:

1. Tap **Foto e raftit**. The first time, photograph the library (for a big one, add a photo per wall —
   “Muri majtas”, “Te dritarja”…).
2. **Tap the shelf on that photo.** Tapping an existing mark continues that shelf; tapping a new spot creates
   the next shelf there.
3. Stand in front of the shelf and photograph about 15 books at a time, left to right.
4. Check the list against the photo: every found book has a number on it. Fix titles, use **+ Shto libër këtu**
   for a missed one, × for something that isn't a book. Positions renumber themselves.
5. Tap **Ruaj**, then **Vazhdo këtë raft** for the next part of the shelf, or **Raft tjetër**.

Finding a book: search, and each result shows a close-up of its spine from the shelf photo. **Shiko ku është**
shows the library photo with a red circle on the shelf, and the shelf photo with the book lit up.

## How it works

- `src/app/api/*` — server routes. Every request must carry the passcode (`x-passcode` header);
  the Supabase and Anthropic keys stay on the server.
  - `books` — list / add, `books/[id]` — mark read / delete, `samples` — add or remove the example books,
    `books/bulk` — saves many books at once, `scan-shelf` — sends a shelf photo to Claude and returns the books
    in left-to-right order, `scan` — reads a single cover and returns `{ title, author }`, `auth` — checks a passcode.
- `src/lib/vision.ts` — sends photos to Gemini (`generateContent`), Groq (OpenAI-compatible chat API) or Claude (`claude-opus-5-5`,
  structured output) and validates the JSON with zod.
- `src/components/Library.tsx` — the main screen. The whole catalog is loaded once and searched in the browser,
  so results appear instantly as you type. It refreshes when the app is reopened, to pick up books added on another phone.
- `src/lib/normalize.ts` — accent-insensitive matching (`ë→e`, `ç→c`, …).
- Cover photos are shrunk in the browser before upload and are not stored anywhere.

Changing the passcode: update `APP_PASSCODE` in Vercel and redeploy; each phone will ask for the new code.
