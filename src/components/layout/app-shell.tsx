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
    // Guard against older cached payloads that predate the readiness field —
    // they would throw TypeError and silently drop all sidebar progress.
    const scores = derived?.readiness?.scores;
    if (
      scores &&
      typeof scores.spaces === "number" &&
      typeof scores.amenities === "number" &&
      typeof scores.systems === "number" &&
      typeof scores.arrival === "number"
    ) {
      sectionScores = {
        spaces: scores.spaces,
        amenities: scores.amenities,
        systems: scores.systems,
        access: scores.arrival,
      };
    }
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
