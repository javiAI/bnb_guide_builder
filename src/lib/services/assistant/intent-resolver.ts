// Intent resolver.
//
// Lightweight classifier that maps the user question to a `journeyStage`
// with a confidence score. Pinned to Claude Haiku 4.5 (cheap + fast);
// model ID is NOT configurable. Dev/test falls back to a keyword-based
// heuristic if `ANTHROPIC_API_KEY` is absent.
//
// The pipeline only uses the stage as a hard filter when confidence ≥ 0.7;
// below that, we keep the full scope.

import Anthropic from "@anthropic-ai/sdk";
import {
  JOURNEY_STAGES,
  type JourneyStage,
} from "@/lib/types/knowledge";

// ============================================================================
// Contract
// ============================================================================

export interface IntentResult {
  journeyStage: JourneyStage;
  confidence: number; // [0, 1]
  modelId: string;
}

export interface IntentResolver {
  readonly modelId: string;
  resolve(question: string, language: string): Promise<IntentResult>;
}

// ============================================================================
// Constants
// ============================================================================

const HAIKU_MODEL = "claude-haiku-4-5-20251001" as const;
const ANTHROPIC_MAX_TOKENS = 64;

// ============================================================================
// Heuristic resolver (dev/test fallback, also the prod fallback if Haiku
// fails — we prefer a noisy guess over blocking the pipeline on intent)
// ============================================================================

const STAGE_KEYWORDS: Array<{
  stage: JourneyStage;
  patterns: RegExp[];
  confidence: number;
}> = [
  {
    stage: "pre_arrival",
    patterns: [
      /\b(before|prior to|before arriv|antes de llegar|reserva|book(ing)?|deposit|depósito|cancelaci)/i,
    ],
    confidence: 0.75,
  },
  {
    stage: "arrival",
    patterns: [
      /\b(check[\s-]?in|arrival|get in|get the key|cómo llego|dirección|address|lockbox|combinación|code to enter|código de acceso)/i,
    ],
    confidence: 0.8,
  },
  {
    stage: "checkout",
    patterns: [
      /\b(check[\s-]?out|leaving|departure|salida|devolver llaves|return key|last day)/i,
    ],
    confidence: 0.8,
  },
  {
    stage: "post_checkout",
    patterns: [
      /\b(after check[\s-]?out|after i leave|tras la salida|refund|reembolso|review|reseña)/i,
    ],
    confidence: 0.7,
  },
  {
    stage: "stay",
    patterns: [
      /\b(wifi|internet|password|contraseña|heating|calefacci|cooling|aire|tv|television|hot water|agua caliente|trash|basura|parking|aparcam|washer|lavador|oven|horno|not working|no funciona)/i,
    ],
    confidence: 0.7,
  },
];

class HeuristicIntentResolver implements IntentResolver {
  readonly modelId = "heuristic:keyword-v1";

  async resolve(question: string, _language: string): Promise<IntentResult> {
    const q = question.toLowerCase();
    let journeyStage: JourneyStage = "any";
    let confidence = 0.3;
    for (const entry of STAGE_KEYWORDS) {
      if (entry.patterns.some((p) => p.test(q)) && entry.confidence > confidence) {
        journeyStage = entry.stage;
        confidence = entry.confidence;
      }
    }
    return { journeyStage, confidence, modelId: this.modelId };
  }
}

// ============================================================================
// Haiku resolver
// ============================================================================

/**
 * The prompt forces Haiku to emit a single line of JSON with two fields,
 * so parsing is trivial and robust. Temperature 0 keeps it deterministic.
 */
function buildClassifierPrompt(language: string): string {
  const stagesList = JOURNEY_STAGES.join(", ");
  const isEn = language === "en";
  if (isEn) {
    return [
      "Classify the user question by travel stage. Respond with ONE line of JSON and nothing else.",
      `Schema: {"journeyStage": "${stagesList}", "confidence": number in [0,1]}`,
      "Stages:",
      "- pre_arrival: before the guest arrives (booking, directions, what to bring).",
      "- arrival: on the day of arrival (check-in, access, keys, lockbox).",
      "- stay: during the stay (wifi, appliances, troubleshooting, rules).",
      "- checkout: the day of departure (how to leave, what to do on exit).",
      "- post_checkout: after departure (refunds, reviews).",
      "- any: does not fit a specific stage.",
      "Use 'any' with confidence 0.3 if unsure.",
    ].join("\n");
  }
  return [
    "Clasifica la pregunta del usuario por etapa del viaje. Responde con UNA línea de JSON y nada más.",
    `Esquema: {"journeyStage": "${stagesList}", "confidence": número en [0,1]}`,
    "Etapas:",
    "- pre_arrival: antes de llegar (reserva, cómo llegar, qué traer).",
    "- arrival: el día de llegada (check-in, acceso, llaves, caja de seguridad).",
    "- stay: durante la estancia (wifi, electrodomésticos, averías, normas).",
    "- checkout: el día de salida (cómo dejar la propiedad).",
    "- post_checkout: tras la salida (reembolsos, reseñas).",
    "- any: no encaja en una etapa específica.",
    "Usa 'any' con confianza 0.3 si no estás seguro.",
  ].join("\n");
}

class HaikuIntentResolver implements IntentResolver {
  readonly modelId = `anthropic:${HAIKU_MODEL}`;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async resolve(question: string, language: string): Promise<IntentResult> {
    try {
      const response = await this.client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        temperature: 0,
        system: buildClassifierPrompt(language),
        messages: [{ role: "user", content: question }],
      });
      const text = response.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      const parsed = parseClassifierOutput(text);
      if (parsed) return { ...parsed, modelId: this.modelId };
    } catch (err) {
      console.warn(
        `[assistant/intent-resolver] Haiku failed, falling back to heuristic: ${(err as Error).message}`,
      );
    }
    // Heuristic fallback (stable pipeline > stuck pipeline).
    return new HeuristicIntentResolver().resolve(question, language);
  }
}

function parseClassifierOutput(
  raw: string,
): { journeyStage: JourneyStage; confidence: number } | null {
  // Accept JSON with optional leading/trailing prose — pick the first {...}.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as {
      journeyStage?: string;
      confidence?: number;
    };
    if (!obj.journeyStage || obj.confidence == null) return null;
    if (!(JOURNEY_STAGES as readonly string[]).includes(obj.journeyStage)) return null;
    const c = Math.max(0, Math.min(1, Number(obj.confidence)));
    return { journeyStage: obj.journeyStage as JourneyStage, confidence: c };
  } catch {
    return null;
  }
}

// ============================================================================
// Resolver
// ============================================================================

let cached: IntentResolver | null = null;
let cachedFingerprint: string | null = null;

export function resolveIntentResolver(): IntentResolver {
  if (cached && cachedFingerprint === "__test__") return cached;
  const fingerprint = `${process.env.ANTHROPIC_API_KEY ? "key" : "no-key"}`;
  if (cached && cachedFingerprint === fingerprint) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (apiKey) {
    cached = new HaikuIntentResolver(apiKey);
  } else {
    cached = new HeuristicIntentResolver();
  }
  cachedFingerprint = fingerprint;
  return cached;
}

/** Test escape hatch. */
export function __setIntentResolverForTests(r: IntentResolver | null): void {
  cached = r;
  cachedFingerprint = r ? "__test__" : null;
}

export const __internal = { parseClassifierOutput, HeuristicIntentResolver };
