"use client";

import { useState, type FormEvent } from "react";
import type { EscalationResolutionDTO } from "@/lib/schemas/assistant.schema";
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

export function AssistantChat({
  propertyId,
  defaultLocale,
}: {
  propertyId: string;
  defaultLocale: string;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [audience, setAudience] = useState<"guest" | "ai" | "internal">("guest");
  const [language, setLanguage] = useState(defaultLocale);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || pending) return;

    setError(null);
    const userTurn: Turn = {
      id: `u-${Date.now()}`,
      role: "user",
      content: q,
    };
    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    setPending(true);

    try {
      const res = await fetch(
        `/api/properties/${propertyId}/assistant/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            language,
            audience,
            conversationId: conversationId ?? undefined,
          }),
        },
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? `HTTP ${res.status}`);
      }
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

  const resetConversation = () => {
    setTurns([]);
    setConversationId(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-[var(--color-neutral-500)]">
          Audiencia
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as typeof audience)}
            className="ml-2 rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-sm"
          >
            <option value="guest">Huésped</option>
            <option value="ai">AI</option>
            <option value="internal">Interno</option>
          </select>
        </label>
        <label className="text-xs text-[var(--color-neutral-500)]">
          Idioma
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="ml-2 rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-sm"
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
        </label>
        <button
          type="button"
          onClick={resetConversation}
          className="ml-auto text-xs text-[var(--color-neutral-500)] underline hover:text-[var(--foreground)]"
        >
          Nueva conversación
        </button>
      </div>

      <div className="flex min-h-[320px] flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
        {turns.length === 0 ? (
          <p className="text-sm text-[var(--color-neutral-400)]">
            Escribe una pregunta sobre la propiedad para empezar.
          </p>
        ) : (
          turns.map((t) => <TurnView key={t.id} turn={t} />)
        )}
        {pending && (
          <p className="text-xs text-[var(--color-neutral-400)]">Pensando…</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-[var(--color-danger-600,#c53030)]">
          Error: {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="¿Cómo se enciende la calefacción?"
          disabled={pending}
          className="flex-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-[var(--radius-lg)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[var(--radius-lg)] bg-[var(--color-primary-50,#f0f7ff)] px-3 py-2 text-sm">
          {turn.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] border border-[var(--border)] px-3 py-2 text-sm">
        {turn.escalated ? (
          <span className="italic text-[var(--color-neutral-500)]">
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
        <ul className="ml-1 space-y-0.5 text-xs text-[var(--color-neutral-500)]">
          {turn.citations.map((c, i) => (
            <li key={c.knowledgeItemId}>
              [{i + 1}] {c.entityLabel}{" "}
              <span className="text-[var(--color-neutral-400)]">
                ({c.sourceType}, rel. {(c.score * 100).toFixed(0)}%)
              </span>
            </li>
          ))}
        </ul>
      )}
      {turn.confidence != null && !turn.escalated && (
        <p className="ml-1 text-[10px] uppercase tracking-wide text-[var(--color-neutral-400)]">
          Confianza {(turn.confidence * 100).toFixed(0)}%
        </p>
      )}
    </div>
  );
}
