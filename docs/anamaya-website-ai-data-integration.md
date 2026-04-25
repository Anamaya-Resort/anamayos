# AnamayOS → Anamaya-Website AI Data Integration

This document is written for the Claude instance working on **anamaya-website** to explain how to read AI data produced by **AnamayOS** (the operations platform at `ao.anamaya.com`).

---

## The Two Projects

| | AnamayOS (ops platform) | Anamaya-Website (marketing site) |
|---|---|---|
| Repo | `Anamaya-Resort/anamayos` | `Anamaya-Resort/anamaya-website` |
| URL | `ao.anamaya.com` | `anamaya.com` / `test.anamaya.com` |
| Supabase ref | `azvdmibriuqrmexwtrja` | `vytqdnwnqiqiwjhqctyi` |
| Purpose | Admin/ops: bookings, guests, settings | Public marketing site |

Each has its own Supabase database. They do **not** share auth. The website reads from AnamayOS's Supabase using the **anon key** (read-only via RLS).

---

## How to Connect from Anamaya-Website

### Environment Variables (add to `.env.local` and Vercel)

```env
# AnamayOS Supabase — read-only AI data
AO_SUPABASE_URL=https://azvdmibriuqrmexwtrja.supabase.co
AO_SUPABASE_ANON_KEY=<the anon/public key from AnamayOS Supabase dashboard>
```

> The anon key is safe to use server-side. It is **not** the service role key — RLS policies restrict it to `SELECT` only on AI tables.

### Creating a Read-Only Client (Next.js App Router, server-side)

Install `@supabase/supabase-js` if not already present. Then create a helper:

```typescript
// src/lib/ao-supabase.ts
import { createClient } from '@supabase/supabase-js';

/**
 * Read-only client for AnamayOS Supabase.
 * Only has SELECT access to AI data tables via anon key + RLS.
 * Never expose AO_SUPABASE_ANON_KEY to the browser — use server components only.
 */
export function createAOClient() {
  const url = process.env.AO_SUPABASE_URL;
  const key = process.env.AO_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('AO Supabase env vars not set');
  return createClient(url, key);
}
```

Use this **only in server components, route handlers, or server actions** — never in `'use client'` components.

---

## Available AI Data Tables

All of these tables live in AnamayOS Supabase and have anon-read RLS policies.

---

### 1. `ai_brand_guide` — Brand voice, messaging, and compiled context

The primary table for on-brand AI writing. Admins create and name multiple guides per org (e.g. "Adventure Seekers", "Wellness Retreaters"). Each guide has:

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `org_id` | uuid | References `organizations.id` |
| `name` | text | Human-readable guide name (e.g. "Default", "Adventure") |
| `voice_tone` | text | 2-3 sentence brand voice description |
| `messaging_points` | jsonb (string[]) | Key messages the brand always emphasizes |
| `usps` | jsonb (string[]) | Unique selling propositions |
| `personality_traits` | jsonb (string[]) | Brand personality descriptors |
| `dos_and_donts` | jsonb `{dos: string[], donts: string[]}` | Writing guardrails |
| `compiled_context` | text | **AI-compiled system prompt** — inject this directly into LLM calls for on-brand output |
| `updated_at` | timestamptz | Last modified |

**Most useful field: `compiled_context`** — This is a 200-300 word AI-generated block, already structured as an LLM system prompt. Use it as-is when asking an AI to write or rewrite content.

#### Example query

```typescript
import { createAOClient } from '@/lib/ao-supabase';

export async function getBrandGuides(orgId: string) {
  const ao = createAOClient();
  const { data, error } = await ao
    .from('ai_brand_guide')
    .select('id, name, compiled_context, voice_tone, messaging_points, usps, personality_traits, dos_and_donts')
    .eq('org_id', orgId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}
```

#### How to use `compiled_context` in an AI call

```typescript
const guide = guides.find(g => g.name === 'Default'); // or let user choose

const response = await openai.chat.completions.create({
  model: 'gpt-5.4',
  messages: [
    {
      role: 'system',
      content: guide.compiled_context, // injects brand voice, USPs, personality, guardrails
    },
    {
      role: 'user',
      content: `Rewrite the following article section in our brand voice:\n\n${articleText}`,
    },
  ],
});
```

---

### 2. `ai_customer_archetypes` — Target audience personas

Each archetype represents a type of guest the resort targets (e.g. Adventure Seeker, Relaxation Seeker, Spiritual Seeker). Used to tailor content tone for specific audiences.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `org_id` | uuid | References `organizations.id` |
| `name` | text | Archetype name (e.g. "Adventure Seeker") |
| `description` | text | One-paragraph overview of this persona |
| `demographics` | jsonb `{}` | Age range, background, income level, etc. |
| `motivations` | jsonb (string[]) | What drives this person to book |
| `pain_points` | jsonb (string[]) | What they worry about or want to avoid |
| `content_tone` | text | Recommended writing style for this audience |
| `sample_messaging` | jsonb (string[]) | Example sentences that resonate with them |
| `sort_order` | int | Display order |
| `is_active` | boolean | Whether this archetype is currently in use |

#### Example query

```typescript
export async function getActiveArchetypes(orgId: string) {
  const ao = createAOClient();
  const { data, error } = await ao
    .from('ai_customer_archetypes')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}
```

#### Using an archetype to target content

```typescript
const archetype = archetypes.find(a => a.name === 'Adventure Seeker');

const userPrompt = `
Write a 3-paragraph section for the Adventures page targeting this audience:
- Description: ${archetype.description}
- Motivations: ${archetype.motivations.join(', ')}
- Tone: ${archetype.content_tone}
- Sample messaging: ${archetype.sample_messaging.join('; ')}

Topic: ${pageTopic}
`;
```

---

### 3. `ai_content_prompts` — Reusable prompt templates

These are admin-created templates for specific content tasks. Each has a `system_prompt` and a `user_prompt_template` with `{{variable}}` placeholders.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `org_id` | uuid | References `organizations.id` |
| `name` | text | Template name (e.g. "Write Article Intro") |
| `category` | text | `article`, `ad_copy`, `video_script`, `ab_test`, `schema` |
| `system_prompt` | text | Full system prompt to inject |
| `user_prompt_template` | text | User prompt with `{{variable}}` placeholders |
| `target_archetype_id` | uuid (nullable) | Pre-linked archetype for this template |
| `is_active` | boolean | Whether template is enabled |
| `sort_order` | int | Display order |

#### Example query + variable substitution

```typescript
export async function getContentPrompts(orgId: string, category?: string) {
  const ao = createAOClient();
  let query = ao
    .from('ai_content_prompts')
    .select('*, archetype:target_archetype_id(name, content_tone, motivations)')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('sort_order');

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// Fill {{variables}} in a template
function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// Usage
const prompt = contentPrompts.find(p => p.category === 'article');
const userPrompt = fillTemplate(prompt.user_prompt_template, {
  topic: 'Yoga retreats at Anamaya',
  length: '500 words',
  tone: 'inspiring',
});
```

---

### 4. `ai_providers` — Which AI providers are connected in AnamayOS

This tells you which providers have API keys configured and what models are available. Useful if you want the website to call the same provider/model that the admin has configured.

| Column | Type | Description |
|---|---|---|
| `id` | text | Provider slug: `openai`, `anthropic`, `google`, `xai` |
| `display_name` | text | e.g. "ChatGPT / OpenAI" |
| `models` | jsonb | Array of model objects (see below) |
| `is_connected` | boolean | Whether a valid API key test has passed |
| `last_tested_at` | timestamptz | When the key was last verified |

Each model in `models`:
```typescript
{
  id: string;         // e.g. "gpt-5.4"
  name: string;       // e.g. "GPT-5.4 (Best)"
  type: 'llm' | 'image';
  endpoint: string;   // the actual model string to pass to the API
  active: boolean;
  added_at: string;
}
```

**Note:** `is_connected` reflects whether AnamayOS has a key — the website uses its own separate API keys. Use this table primarily to know which models are available and what their `endpoint` strings are.

---

## Finding the Org ID

All AI tables are scoped to `org_id`. To find Anamaya Resort's org ID:

```typescript
export async function getAnamayaOrgId() {
  const ao = createAOClient();
  const { data } = await ao
    .from('organizations')
    .select('id')
    .eq('slug', 'anamaya') // or whatever the slug is
    .single();
  return data?.id ?? null;
}
```

Or hardcode it after the first lookup — the org ID won't change. Store it as an env var:

```env
AO_ORG_ID=<uuid from organizations table>
```

---

## Recommended Pattern: `getAIContext()` Server Utility

A single server-side helper that fetches everything the website needs for AI content generation:

```typescript
// src/lib/ai-context.ts
import { createAOClient } from './ao-supabase';

const ORG_ID = process.env.AO_ORG_ID!;

export async function getAIContext(options?: {
  guideName?: string;        // default: first guide
  archetypeName?: string;    // optional: filter to one archetype
  promptCategory?: string;   // optional: filter prompt templates
}) {
  const ao = createAOClient();

  const [guidesResult, archetypesResult, promptsResult] = await Promise.all([
    ao.from('ai_brand_guide')
      .select('id, name, compiled_context, voice_tone, messaging_points, usps, personality_traits, dos_and_donts')
      .eq('org_id', ORG_ID)
      .order('name'),

    ao.from('ai_customer_archetypes')
      .select('*')
      .eq('org_id', ORG_ID)
      .eq('is_active', true)
      .order('sort_order'),

    ao.from('ai_content_prompts')
      .select('*')
      .eq('org_id', ORG_ID)
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  const guides = guidesResult.data ?? [];
  const archetypes = archetypesResult.data ?? [];
  const prompts = promptsResult.data ?? [];

  const guide = options?.guideName
    ? guides.find(g => g.name === options.guideName) ?? guides[0]
    : guides[0];

  const archetype = options?.archetypeName
    ? archetypes.find(a => a.name === options.archetypeName)
    : null;

  const filteredPrompts = options?.promptCategory
    ? prompts.filter(p => p.category === options.promptCategory)
    : prompts;

  return {
    guide,           // use guide.compiled_context as system prompt
    archetypes,      // full list
    archetype,       // single targeted archetype if requested
    prompts: filteredPrompts,
    // convenience: system prompt ready to inject
    systemPrompt: guide?.compiled_context ?? '',
  };
}
```

### Usage in a server component or route handler

```typescript
// Example: article rewrite API route
import { getAIContext } from '@/lib/ai-context';

export async function POST(req: Request) {
  const { articleText, archetypeName } = await req.json();

  const { systemPrompt, archetype } = await getAIContext({ archetypeName });

  const fullSystem = [
    systemPrompt,
    archetype ? `\n\nTarget audience: ${archetype.description}\nTone: ${archetype.content_tone}` : '',
  ].join('');

  // ... call your AI provider with fullSystem + articleText
}
```

---

## What's Managed in AnamayOS Admin

All of the data above is created and edited by the resort admin in AnamayOS at:

- `ao.anamaya.com/dashboard/settings#ai-data` — Brand Guides, Archetypes, Content Prompts
- Admins can have multiple named brand guides (e.g. one per audience type or season)
- Archetypes come pre-seeded (Adventure Seeker, Relaxation Seeker, Health Seeker, etc.) and can be customized
- Content prompt templates are fully custom with `{{variable}}` syntax

The website should treat this data as **read-only**. Never write back to AnamayOS Supabase from the website — the anon key only allows SELECT.

---

## Security Notes

- `AO_SUPABASE_URL` and `AO_SUPABASE_ANON_KEY` must **never** be exposed to the browser (`NEXT_PUBLIC_` prefix = dangerous)
- All queries using these vars must be in server components, server actions, or API route handlers
- The anon key has SELECT-only access to AI tables. It cannot write, update, or delete anything in AnamayOS
- Do not store `AO_SUPABASE_ANON_KEY` in any client-side state, logs, or error messages
