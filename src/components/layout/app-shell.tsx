import { SideNav } from "./side-nav";
import { getDerived } from "@/lib/services/property-derived.service";

interface AppShellProps {
  propertyId: string;
  propertyNickname: string;
  children: React.ReactNode;
}

export async function AppShell({ propertyId, propertyNickname, children }: AppShellProps) {
  // Cached derived payload — drives sidebar progress badges. Falls back to no
  // scores if anything blows up so a stale cache never breaks navigation.
  let sectionScores: Record<string, number> | undefined;
  try {
    const derived = await getDerived(propertyId);
    sectionScores = {
      spaces: derived.readiness.scores.spaces,
      amenities: derived.readiness.scores.amenities,
      systems: derived.readiness.scores.systems,
      access: derived.readiness.scores.arrival,
    };
  } catch {
    sectionScores = undefined;
  }

  return (
    <div className="min-h-screen">
      <SideNav
        propertyId={propertyId}
        propertyNickname={propertyNickname}
        sectionScores={sectionScores}
      />
      <main
        className="min-h-screen bg-[var(--surface)]"
        style={{ marginLeft: "var(--sidebar-width)" }}
      >
        <div className="mx-auto max-w-4xl px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
