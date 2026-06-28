import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODELS = ["gemini-3.5-flash", "gemini-2.5-flash"];

function strip(html: string): string {
  return html
    .replace(/<(script|style|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    return strip(await res.text());
  } catch {
    return "";
  }
}

async function crawl(domain: string): Promise<{ text: string; pages: string[] }> {
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  const origin = new URL(base).origin;
  const urls = [base, `${origin}/about`, `${origin}/pricing`];
  const parts = await Promise.all(urls.map(fetchText));
  const pages = urls.filter((_, i) => parts[i]);
  return { text: parts.filter(Boolean).join("\n\n").slice(0, 12000), pages };
}

function buildPrompt(domain: string, offer: string, text: string): string {
  return `You are a deal-engineering analyst. A sales rep is pursuing the account below. Use Google Search for the latest information, then produce a one-page deal dossier in markdown. Be specific, cite concrete facts, no filler.

### 1. What they do
### 2. Live signals
Recent news, funding, hiring, product launches, or leadership changes from roughly the last 12 months that suggest whether they are in a buying cycle. Cite specifics.
### 3. Likely priorities and pains
### 4. Value thesis
Why ${offer} should matter to them. Three bullets.
### 5. Suggested first-meeting opener
Two sentences.
### 6. Three discovery questions

After the dossier, append one fenced code block tagged json (and nothing after it) with this exact shape. Valid JSON, no comments, no trailing commas:
\`\`\`json
{
  "company": "one sentence on what they do",
  "signals": [{ "date": "YYYY-MM", "kind": "funding|hiring|product|leadership|news", "label": "short title", "detail": "one sentence" }],
  "priorities": ["..."],
  "pains": ["..."],
  "value": [{ "point": "short", "why": "one sentence" }],
  "questions": ["q1", "q2", "q3"]
}
\`\`\`
Only include signals you actually found, each with a date. Keep the JSON compact.

Account: ${domain}
What we sell: ${offer}

Homepage and key pages:
${text}`;
}

function transient(e: unknown): boolean {
  const err = e as { status?: number; code?: number; message?: string };
  const code = Number(err?.status ?? err?.code);
  if ([429, 500, 503].includes(code)) return true;
  return /unavailable|overloaded|rate limit|\b429\b|\b503\b/i.test(String(err?.message ?? ""));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function startStream(ai: GoogleGenAI, contents: string) {
  let last: unknown;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const stream = await ai.models.generateContentStream({
          model,
          contents,
          config: { tools: [{ googleSearch: {} }], temperature: 0.3, maxOutputTokens: 8192 },
        });
        return { stream, model };
      } catch (e) {
        last = e;
        if (!transient(e)) throw e;
        await sleep(500 * 2 ** attempt);
      }
    }
  }
  throw last;
}

export async function POST(req: Request) {
  const { domain, offer } = await req.json().catch(() => ({}));
  if (!domain || typeof domain !== "string") {
    return new Response("domain is required", { status: 400 });
  }
  const apiKey = process.env.GENAI_API_KEY;
  if (!apiKey) return new Response("GENAI_API_KEY is not set", { status: 500 });

  const { text, pages } = await crawl(domain);
  if (!text) return new Response("could not read that site", { status: 422 });

  const ai = new GoogleGenAI({ apiKey });
  const contents = buildPrompt(domain, (offer || "(not specified)").toString(), text);

  let started: Awaited<ReturnType<typeof startStream>>;
  try {
    started = await startStream(ai, contents);
  } catch (e) {
    return new Response(`model unavailable: ${(e as Error)?.message ?? e}`, { status: 502 });
  }
  const { stream, model } = started;

  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let grounding: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } | undefined;
      let searches: string[] = [];
      try {
        for await (const chunk of stream) {
          if (chunk.text) controller.enqueue(enc.encode(chunk.text));
          const gm = chunk.candidates?.[0]?.groundingMetadata;
          if (gm) {
            grounding = gm;
            if (gm.webSearchQueries?.length) searches = gm.webSearchQueries;
          }
        }
        const seen = new Set<string>();
        const lines = (grounding?.groundingChunks ?? [])
          .map((c) => c.web)
          .filter((w): w is { uri: string; title?: string } => {
            if (!w?.uri || seen.has(w.uri)) return false;
            seen.add(w.uri);
            return true;
          })
          .map((w) => `- [${w.title || w.uri}](${w.uri})`)
          .join("\n");
        if (lines) controller.enqueue(enc.encode(`\n\n---\n\n### Sources\n${lines}\n`));
        const meta = JSON.stringify({ crawled: pages, searches, model });
        controller.enqueue(enc.encode(`\n\n\`\`\`dossier-meta\n${meta}\n\`\`\`\n`));
      } catch (e) {
        controller.enqueue(enc.encode(`\n\n_[stream interrupted: ${(e as Error)?.message ?? e}]_`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
