"use client";

import { useState } from "react";

export type Signal = { date?: string; kind?: string; label: string; detail?: string };
export type ValuePoint = { point: string; why?: string };
export type Graphics = {
  company?: string;
  signals?: Signal[];
  priorities?: string[];
  pains?: string[];
  value?: ValuePoint[];
};
export type Meta = { crawled?: string[]; searches?: string[]; model?: string };

function grab(raw: string, tag: string): { json: string | null; rest: string } {
  const m = raw.match(new RegExp("```" + tag + "\\s*([\\s\\S]*?)```"));
  if (!m) return { json: null, rest: raw };
  return { json: m[1].trim(), rest: raw.replace(m[0], "").trim() };
}

export function splitDossier(raw: string): { display: string; graphics: Graphics | null; meta: Meta | null } {
  const g = grab(raw, "json");
  const me = grab(g.rest, "dossier-meta");
  let graphics: Graphics | null = null;
  let meta: Meta | null = null;
  try {
    if (g.json) graphics = JSON.parse(g.json);
  } catch {}
  try {
    if (me.json) meta = JSON.parse(me.json);
  } catch {}
  // drop a half-streamed, not-yet-closed block so the raw fence never flashes in the prose
  const display = me.rest.replace(/```(json|dossier-meta)[\s\S]*$/, "").trim();
  return { display, graphics, meta };
}

const KIND: Record<string, { dot: string; tag: string }> = {
  funding: { dot: "bg-emerald-400", tag: "text-emerald-400" },
  hiring: { dot: "bg-sky-400", tag: "text-sky-400" },
  product: { dot: "bg-violet-400", tag: "text-violet-400" },
  leadership: { dot: "bg-amber-400", tag: "text-amber-400" },
  news: { dot: "bg-slate-400", tag: "text-slate-400" },
};

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex cursor-help items-center">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[16rem] -translate-x-1/2 whitespace-normal rounded-md border border-line bg-canvas px-2.5 py-1.5 text-[11px] font-normal normal-case leading-snug tracking-normal text-ink opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {label}
        <span className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-line bg-canvas" />
      </span>
    </span>
  );
}

function Hint({ label }: { label: string }) {
  return (
    <Tip label={label}>
      <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line font-mono text-[10px] lowercase text-muted transition-colors hover:border-accent hover:text-accent">
        i
      </span>
    </Tip>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-line px-1.5 py-0.5">{children}</span>;
}

function ActivityStrip({ meta }: { meta: Meta }) {
  const crawled = meta.crawled ?? [];
  const searches = meta.searches ?? [];
  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
      <span className="flex items-center text-accent">
        agent run
        <Hint label="A quick log of what the agent did to research this account before writing the dossier." />
      </span>
      <Tip label={crawled.length ? `Pages the agent read directly from their site: ${crawled.join(", ")}` : "No pages were readable on the site."}>
        <Badge>crawled {crawled.length} page{crawled.length === 1 ? "" : "s"}</Badge>
      </Tip>
      <Tip label={searches.length ? `Live Google searches the agent ran while researching: ${searches.join("  •  ")}` : "No live searches were needed."}>
        <Badge>ran {searches.length} search{searches.length === 1 ? "" : "es"}</Badge>
      </Tip>
    </div>
  );
}

function Timeline({ signals }: { signals: Signal[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const sorted = [...signals].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return (
    <ol className="relative ml-1 border-l border-line">
      {sorted.map((s, i) => {
        const k = KIND[s.kind || "news"] || KIND.news;
        const isOpen = open === i;
        return (
          <li key={i} className="relative pb-3 pl-5">
            <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${k.dot}`} />
            <button onClick={() => setOpen(isOpen ? null : i)} className="block w-full text-left">
              {s.date && <span className="font-mono text-[11px] text-muted">{s.date} </span>}
              <span className={`font-mono text-[10px] uppercase tracking-wider ${k.tag}`}>{s.kind || "news"}</span>
              <span className="block text-sm text-ink">{s.label}</span>
            </button>
            {isOpen && s.detail && <p className="mt-1 text-xs text-muted">{s.detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function Chips({ items, label, hint }: { items: string[]; label: string; hint?: string }) {
  const [on, setOn] = useState<Set<number>>(new Set());
  return (
    <div>
      <h3 className="mb-1.5 flex items-center font-mono text-[10px] uppercase tracking-widest text-muted">
        {label}
        {hint && <Hint label={hint} />}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => {
          const active = on.has(i);
          return (
            <button
              key={i}
              onClick={() =>
                setOn((p) => {
                  const n = new Set(p);
                  if (n.has(i)) n.delete(i);
                  else n.add(i);
                  return n;
                })
              }
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                active ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-ink"
              }`}
            >
              {active ? "✓ " : ""}
              {it}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ValueCards({ value }: { value: ValuePoint[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div>
      <h3 className="mb-1.5 flex items-center font-mono text-[10px] uppercase tracking-widest text-muted">
        Why it matters
        <Hint label="The agent's thesis for why your offer fits this account. Click a card to see the reasoning." />
      </h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {value.map((v, i) => {
          const isOpen = open === i;
          return (
            <button
              key={i}
              onClick={() => setOpen(isOpen ? null : i)}
              className="rounded-md border border-line bg-canvas p-3 text-left transition hover:border-accent"
            >
              <span className="block text-sm text-ink">{v.point}</span>
              {isOpen && v.why && <span className="mt-1.5 block text-xs text-muted">{v.why}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DossierExtras({ graphics, meta }: { graphics: Graphics | null; meta: Meta | null }) {
  const hasGraphics =
    graphics &&
    ((graphics.signals?.length ?? 0) +
      (graphics.priorities?.length ?? 0) +
      (graphics.pains?.length ?? 0) +
      (graphics.value?.length ?? 0) >
      0);
  if (!hasGraphics && !meta) return null;
  return (
    <div className="mt-6 flex flex-col gap-5 border-t border-line pt-5">
      {meta && <ActivityStrip meta={meta} />}
      {graphics?.company && <p className="text-sm text-ink">{graphics.company}</p>}
      {!!graphics?.signals?.length && (
        <div>
          <h3 className="mb-2 flex items-center font-mono text-[10px] uppercase tracking-widest text-muted">
            Signals timeline
            <Hint label="Dated events the agent found in live research: funding, hiring, launches, leadership. Newest first. Click any node to expand the detail." />
          </h3>
          <Timeline signals={graphics.signals} />
        </div>
      )}
      {(!!graphics?.priorities?.length || !!graphics?.pains?.length) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {!!graphics?.priorities?.length && (
            <Chips
              items={graphics.priorities}
              label="Priorities"
              hint="What likely matters most to this account right now, inferred by the agent from its research. Click to mark the ones you plan to target."
            />
          )}
          {!!graphics?.pains?.length && (
            <Chips
              items={graphics.pains}
              label="Pains"
              hint="Problems the agent inferred they are probably facing, worth probing in your discovery questions."
            />
          )}
        </div>
      )}
      {!!graphics?.value?.length && <ValueCards value={graphics.value} />}
    </div>
  );
}
