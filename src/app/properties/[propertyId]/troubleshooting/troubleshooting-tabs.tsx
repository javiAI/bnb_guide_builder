import Link from "next/link";

interface TroubleshootingTabsProps {
  propertyId: string;
  active: "playbooks" | "incidents";
}

export function TroubleshootingTabs({ propertyId, active }: TroubleshootingTabsProps) {
  const tabs: Array<{ key: "playbooks" | "incidents"; label: string; href: string }> = [
    { key: "playbooks", label: "Playbooks", href: `/properties/${propertyId}/troubleshooting` },
    { key: "incidents", label: "Ocurrencias", href: `/properties/${propertyId}/troubleshooting/incidents` },
  ];
  return (
    <nav className="mt-4 flex gap-1 border-b border-[var(--border)]">
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={
              isActive
                ? "border-b-2 border-[var(--color-primary-500)] px-4 py-2 text-sm font-medium text-[var(--color-primary-600)]"
                : "border-b-2 border-transparent px-4 py-2 text-sm text-[var(--color-neutral-500)] hover:text-[var(--foreground)]"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
