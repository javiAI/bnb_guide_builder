"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Clock, Plus, Send } from "lucide-react";
import type { EscalationResolutionDTO } from "@/lib/schemas/assistant.schema";
import { formatRelativeEs } from "@/lib/format-relative-es";
import { VISIBILITY_LABEL, normaliseVisibility } from "@/lib/visibility";
import { EscalationHandoff } from "./EscalationHandoff";

interface Citation {
  knowledgeItemId: string;
  sourceType: string;
  entityLabel: string;
  score: number;
}

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  escalated?: boolean;
  escalationReason?: string | null;
  escalationContact?: EscalationResolutionDTO | null;
  confidence?: number;
}

interface ConversationSummary {
  id: string;
  audience: string;
  messageCount: number;
  preview: string | null;
  updatedAt: string;
}

interface ServerMessage {
  id: string;
  role: string;
  body: string;
  citationsJson: {
    citations?: Citation[];
    escalationReason?: string | null;
    escalationContact?: EscalationResolutionDTO | null;
  } | null;
  confidenceScore: number | null;
  escalated: boolean;
}

// Audiences the operator can impersonate (guest < ai < internal); labels come
// from the shared VISIBILITY_LABEL source of truth.
const AUDIENCE_OPTIONS = ["guest", "ai", "internal"] as const;

const CTRL_BTN_CLASS =
  "inline-flex min-h-8 items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]";
const SELECT_CLASS =
  "rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-1.5 py-1 text-[12px] text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]";

function mapMessageToTurn(m: ServerMessage): Turn {
  if (m.role === "user") {
    return { id: m.id, role: "user", content: m.body };
  }
  return {
    id: m.id,
    role: "assistant",
    content: m.body,
    citations: m.citationsJson?.citations ?? [],
    escalated: m.escalated,
    escalationReason: m.citationsJson?.escalationReason ?? null,
    escalationContact: m.citationsJson?.escalationContact ?? null,
    confidence: m.confidenceScore ?? undefined,
  };
}

/**
 * Reusable operator assistant (Liora 16F.5). Persists conversations server-side
 * (`/assistant/ask`) and can list + resume past ones. Layout adapts:
 * - `fill` (rail dock, floating popover): fills a bounded parent, messages scroll
 *   internally, input pinned at the bottom.
 * - default (the `/ai` page): grows with content, the page scrolls.
 * The empty state is minimalist — a single prompt, no large empty box — so the
 * first use doesn't read as a blank void. `autoResumeLast` reopens the most
 * recent conversation on mount (companion surfaces continue where you left off).
 */
export function AssistantChat({
  propertyId,
  defaultLocale,
  fill = false,
  autoResumeLast = false,
}: {
  propertyId: string;
  defaultLocale: string;
  fill?: boolean;
  autoResumeLast?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [audience, setAudience] = useState<"guest" | "ai" | "internal">("guest");
  const [language, setLanguage] = useState(defaultLocale);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resumedRef = useRef(false);

  const loadConversation = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/assistant-conversations/${id}/messages`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message ?? `HTTP ${res.status}`);
      setTurns((payload.data as ServerMessage[]).map(mapMessageToTurn));
      setConversationId(id);
      setView("chat");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const fetchList = useCallback(async (): Promise<ConversationSummary[]> => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/assistant/conversations`);
      const payload = await res.json();
      return res.ok ? (payload.data as ConversationSummary[]) : [];
    } catch {
      return []; // fail-soft: callers render a neutral empty list
    }
  }, [propertyId]);

  const fetchConversations = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setConversations(await fetchList());
    } finally {
      setHistoryLoading(false);
    }
  }, [fetchList]);

  // Companion surfaces resume the most recent conversation on first mount. The
  // list fetch doubles as the history-view cache (see openHistory).
  useEffect(() => {
    if (!autoResumeLast || resumedRef.current) return;
    resumedRef.current = true;
    void (async () => {
      const list = await fetchList();
      setConversations(list);
      if (list.length > 0) await loadConversation(list[0].id);
    })();
  }, [autoResumeLast, fetchList, loadConversation]);

  // Keep the scroll pinned to the latest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, pending]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || pending) return;

    setError(null);
    setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: q }]);
    setInput("");
    setPending(true);

    try {
      const res = await fetch(`/api/properties/${propertyId}/assistant/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          language,
          audience,
          conversationId: conversationId ?? undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message ?? `HTTP ${res.status}`);
      const data = payload.data as {
        answer: string;
        citations: Citation[];
        escalated: boolean;
        escalationReason: string | null;
        escalationContact: EscalationResolutionDTO | null;
        confidenceScore: number;
        conversationId: string;
      };
      setConversationId(data.conversationId);
      setConversations(null); // invalidate the cached history list (count/preview changed)
      setTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          escalated: data.escalated,
          escalationReason: data.escalationReason,
          escalationContact: data.escalationContact,
          confidence: data.confidenceScore,
        },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  const newConversation = () => {
    setTurns([]);
    setConversationId(null);
    setError(null);
    setView("chat");
  };

  const openHistory = () => {
    setView("history");
    // The list is cached in state; only (re)fetch when stale — null after a
    // send invalidates it, or it was never loaded.
    if (conversations === null) void fetchConversations();
  };

  const isEmpty = turns.length === 0 && !pending;

  return (
    <div className={`flex flex-col gap-2.5 ${fill ? "h-full min-h-0" : ""}`}>
      {/* ── Controls ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {view === "chat" ? (
          <>
            <button type="button" onClick={openHistory} className={CTRL_BTN_CLASS}>
              <Clock size={13} aria-hidden="true" />
              Historial
            </button>
            <button type="button" onClick={newConversation} className={CTRL_BTN_CLASS}>
              <Plus size={13} aria-hidden="true" />
              Nueva
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <select
                aria-label="Audiencia"
                value={audience}
                onChange={(e) => setAudience(e.target.value as typeof audience)}
                className={SELECT_CLASS}
              >
                {AUDIENCE_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {VISIBILITY_LABEL[a]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Idioma"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="es">ES</option>
                <option value="en">EN</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setView("chat")} className={CTRL_BTN_CLASS}>
              <ArrowLeft size={13} aria-hidden="true" />
              Volver
            </button>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              Conversaciones
            </span>
          </>
        )}
      </div>

      {/* ── Body ── */}
      {view === "history" ? (
        <div className={`${fill ? "min-h-0 flex-1" : "max-h-[400px]"} overflow-y-auto`}>
          {historyLoading ? (
            <p className="px-1 py-2 text-[13px] text-[var(--color-text-muted)]">Cargando…</p>
          ) : !conversations || conversations.length === 0 ? (
            <p className="px-1 py-2 text-[13px] text-[var(--color-text-muted)]">
              Aún no hay conversaciones guardadas.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => loadConversation(c.id)}
                    className="w-full rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-left transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
                  >
                    <p className="line-clamp-2 text-[13px] font-medium text-[var(--color-text-primary)]">
                      {c.preview ?? "Conversación sin título"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                      {formatRelativeEs(c.updatedAt)} · {c.messageCount}{" "}
                      {c.messageCount === 1 ? "mensaje" : "mensajes"} ·{" "}
                      {VISIBILITY_LABEL[normaliseVisibility(c.audience)]}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : isEmpty ? (
        <div
          className={
            fill
              ? "grid min-h-0 flex-1 place-items-center px-2 text-center"
              : "px-1 py-3"
          }
        >
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Pregúntame lo que necesites sobre la propiedad.
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className={`flex flex-col gap-3 ${fill ? "min-h-0 flex-1 overflow-y-auto" : ""}`}
        >
          {turns.map((t) => (
            <TurnView key={t.id} turn={t} />
          ))}
          {pending && (
            <p className="text-[12px] text-[var(--color-text-muted)]">Pensando…</p>
          )}
        </div>
      )}

      {error && (
        <p className="shrink-0 text-[13px] text-[var(--color-status-error-text)]">Error: {error}</p>
      )}

      {/* ── Input ── */}
      {view === "chat" && (
        <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="¿Cómo se enciende la calefacción?"
            disabled={pending}
            className="min-h-[44px] flex-1 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            aria-label="Enviar pregunta"
            className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[10px] bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:opacity-50"
          >
            <Send size={16} aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[12px] bg-[var(--color-action-primary-subtle)] px-3 py-2 text-[13px] text-[var(--color-action-primary-subtle-fg)]">
          {turn.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-[90%] whitespace-pre-wrap rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-[13px] text-[var(--color-text-primary)]">
        {turn.escalated ? (
          <span className="italic text-[var(--color-text-secondary)]">
            No encontré una respuesta fiable
            {turn.escalationReason ? ` — ${turn.escalationReason}` : ""}.
          </span>
        ) : (
          turn.content
        )}
      </div>
      {turn.escalated && turn.escalationContact && (
        <EscalationHandoff handoff={turn.escalationContact} />
      )}
      {turn.citations && turn.citations.length > 0 && (
        <ul className="ml-1 space-y-0.5 text-[11px] text-[var(--color-text-secondary)]">
          {turn.citations.map((c, i) => (
            <li key={c.knowledgeItemId}>
              [{i + 1}] {c.entityLabel}{" "}
              <span className="text-[var(--color-text-muted)]">
                ({c.sourceType}, rel. {(c.score * 100).toFixed(0)}%)
              </span>
            </li>
          ))}
        </ul>
      )}
      {turn.confidence != null && !turn.escalated && (
        <p className="ml-1 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
          Confianza {(turn.confidence * 100).toFixed(0)}%
        </p>
      )}
    </div>
  );
}
