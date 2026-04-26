import { withOperatorGuards } from "@/lib/auth/operator-guards";
import { applyImportHandler } from "../../shared/make-apply-route";

export const POST = withOperatorGuards<{ propertyId: string }>(
  applyImportHandler("airbnb"),
  { rateLimit: "mutate" },
);
