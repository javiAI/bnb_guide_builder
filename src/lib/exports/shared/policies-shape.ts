// Narrow view of the shape produced by the policies form. Shared between
// platform exporters since they all read the same `policiesJson` blob.
export interface PoliciesShape {
  quietHours?: { enabled?: boolean; from?: string; to?: string };
  smoking?: string;
  events?: { policy?: string; maxPeople?: number };
  pets?: { allowed?: boolean };
  commercialPhotography?: string;
  services?: { allowed?: boolean };
}

export function asPolicies(value: Record<string, unknown> | null): PoliciesShape {
  return (value ?? {}) as PoliciesShape;
}
