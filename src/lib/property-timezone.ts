// Helpers to interpret and render datetimes in a Property's IANA timezone.
// When `timeZone` is null/empty we fall back to the server's local TZ.

function getTZOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(instant).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - instant.getTime();
}

// Interpret a `datetime-local` string ("YYYY-MM-DDTHH:mm") as wall time
// in the given IANA timezone and return the corresponding UTC Date.
export function zonedLocalToUTC(local: string, timeZone: string | null | undefined): Date {
  if (!local) return new Date(NaN);
  if (!timeZone) return new Date(local);
  // Treat the string as if it were UTC, then subtract the TZ offset at that instant.
  const asUTC = new Date(`${local}Z`).getTime();
  if (Number.isNaN(asUTC)) return new Date(NaN);
  const offset = getTZOffsetMs(new Date(asUTC), timeZone);
  return new Date(asUTC - offset);
}

export function formatInPropertyTZ(
  date: Date,
  timeZone: string | null | undefined,
  locale: string = "es-ES",
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timeZone ?? undefined,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
