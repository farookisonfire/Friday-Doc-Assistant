"use client";

import { useRef, useState } from "react";
import type { FormattedCitations } from "@/lib/formatCitations";

type ChatResponse = FormattedCitations & { traceId: string; isRefusal: boolean };

type Status = "idle" | "loading" | "done" | "error";

export default function ChatInterface() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function submit() {
    const q = question.trim();
    if (!q || status === "loading") return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setResponse(null);
    setErrorMessage("");
    setCopied(false);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setErrorMessage(text || `Request failed (${res.status})`);
        setStatus("error");
        return;
      }

      const data: ChatResponse = await res.json();
      setResponse(data);
      setStatus("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function clear() {
    abortRef.current?.abort();
    setQuestion("");
    setResponse(null);
    setStatus("idle");
    setErrorMessage("");
    setCopied(false);
  }

  async function copyTraceId(id: string) {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <textarea
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
          rows={4}
          placeholder="Ask a question about the docs…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={status === "loading"}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={!question.trim() || status === "loading"}
            className="rounded-lg bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "loading" ? "Thinking…" : "Ask"}
          </button>
          {(status === "done" || status === "error") && (
            <button
              onClick={clear}
              className="text-sm text-zinc-500 transition hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {status === "error" && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      {status === "done" && response && (
        <div className="flex flex-col gap-6">
          {response.isRefusal && (
            <div className="rounded-lg border border-amber-900 bg-amber-950/40 px-4 py-3 text-xs font-medium uppercase tracking-widest text-amber-500">
              Outside scope
            </div>
          )}

          <div className="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
            {response.answer}
          </div>

          {response.sources.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                Sources
              </p>
              <div className="flex flex-col gap-2">
                {response.sources.map((src) => (
                  <a
                    key={src.index}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:border-zinc-700"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-zinc-600">[{src.index}]</span>
                      <span className="text-sm font-medium text-zinc-200 group-hover:text-white">
                        {src.title}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-2">{src.snippet}</p>
                    <p className="text-xs text-zinc-700 group-hover:text-zinc-500 transition">
                      {src.url}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-zinc-900 pt-4">
            <span className="font-mono text-xs text-zinc-700">{response.traceId}</span>
            <button
              onClick={() => copyTraceId(response.traceId)}
              className="text-xs text-zinc-600 transition hover:text-zinc-400"
            >
              {copied ? "Copied" : "Copy trace ID"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
