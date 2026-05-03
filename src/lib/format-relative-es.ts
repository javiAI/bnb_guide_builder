export function formatRelativeEs(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `hace ${weeks} sem`;
  const months = Math.round(days / 30);
  return `hace ${months} mes${months === 1 ? "" : "es"}`;
}
