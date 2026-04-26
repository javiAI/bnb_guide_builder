import { NextResponse } from "next/server";
import { debugRetrieveRequestSchema } from "@/lib/schemas/assistant.schema";
import { retrieve } from "@/lib/services/assistant/pipeline";
import { withOperatorGuards } from "@/lib/auth/operator-guards";

export const POST = withOperatorGuards<{ propertyId: string }>(
  async (request, { params }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = debugRetrieveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payload",
            details: { fieldErrors: parsed.error.flatten().fieldErrors },
          },
        },
        { status: 400 },
      );
    }

    const { question, language, audience } = parsed.data;
    const results = await retrieve({
      propertyId: params.propertyId,
      question,
      language,
      audience,
    });

    return NextResponse.json({ data: results });
  },
  { rateLimit: "expensive" },
);
