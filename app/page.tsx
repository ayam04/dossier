"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { splitDossier, DossierExtras } from "./components/dossier-graphics";

type Item = { domain: string; offer: string; output: string; ts: number };

const KEY = "deal-dossier-history";

export default function Home() {
  const [domain, setDomain] = useState("");
  const [offer, setOffer] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [history, setHistory] = useState<Item[]>([]);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/share?id=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error((await res.text()) || "could not load shared dossier");
        const d = await res.json();
        setOutput(d.output || "");
        setDomain(d.domain || "");
      } catch (e) {
        setError((e as Error)?.message || "could not load shared dossier");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function save(item: Item) {
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, 50);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }

  async function generate() {
    if (!domain.trim() || loading) return;
    setLoading(true);
    setError("");
    setOutput("");
    let acc = "";
    try {
      const res = await fetch("/api/dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), offer: offer.trim() }),
      });
      if (!res.ok || !res.body) {
        throw new Error((await res.text()) || `request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setOutput(acc);
      }
      if (acc.trim()) {
        save({ domain: domain.trim(), offer: offer.trim(), output: acc, ts: Date.now() });
      }
    } catch (e) {
      setError((e as Error)?.message || "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    const { display } = splitDossier(output);
    const blob = new Blob([display], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${domain.trim() || "dossier"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function share() {
    if (!output || sharing) return;
    setSharing(true);
    setShareMsg("");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output, domain: domain.trim() }),
      });
      if (!res.ok) throw new Error((await res.text()) || "share failed");
      const { id } = await res.json();
      await navigator.clipboard.writeText(`${window.location.origin}/?id=${id}`);
      setShareMsg("Link copied");
    } catch (e) {
      setShareMsg((e as Error)?.message || "share failed");
    } finally {
      setSharing(false);
      setTimeout(() => setShareMsg(""), 2500);
    }
  }

  const { display, graphics, meta } = splitDossier(output);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-8">
        <h1 className="font-mono text-xl font-bold tracking-tight text-accent">deal-dossier</h1>
        <p className="mt-1 text-sm text-muted">
          Drop a company domain. Get a grounded, meeting-ready deal dossier with live signals.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="flex-1 rounded-md border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="company domain (e.g. stripe.com)"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
        />
        <input
          className="flex-1 rounded-md border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="what you sell (optional)"
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
        />
        <button
          onClick={generate}
          disabled={loading || !domain.trim()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition disabled:opacity-40"
        >
          {loading ? "Researching..." : "Generate"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {output && (
        <section className="mt-6 rounded-lg border border-line bg-panel p-5">
          <div className="mb-3 flex items-center justify-end gap-2">
            {shareMsg && <span className="mr-auto text-xs text-accent">{shareMsg}</span>}
            <button
              onClick={() => navigator.clipboard.writeText(display)}
              className="rounded border border-line px-2 py-1 text-xs text-muted hover:text-white"
            >
              Copy
            </button>
            <button
              onClick={download}
              className="rounded border border-line px-2 py-1 text-xs text-muted hover:text-white"
            >
              Download .md
            </button>
            <button
              onClick={share}
              disabled={sharing}
              className="rounded border border-line px-2 py-1 text-xs text-muted hover:text-white disabled:opacity-40"
            >
              {sharing ? "Sharing..." : "Share"}
            </button>
          </div>
          <DossierExtras graphics={graphics} meta={meta} />
          <div className="dossier text-sm leading-relaxed">
            <ReactMarkdown>{display}</ReactMarkdown>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">History</h2>
          <ul className="flex flex-col gap-1">
            {history.map((h) => (
              <li key={h.ts}>
                <button
                  onClick={() => {
                    setDomain(h.domain);
                    setOffer(h.offer);
                    setOutput(h.output);
                    setError("");
                  }}
                  className="w-full truncate rounded px-2 py-1 text-left text-sm text-muted hover:bg-line hover:text-white"
                >
                  {h.domain}
                  {h.offer ? ` - ${h.offer}` : ""}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
