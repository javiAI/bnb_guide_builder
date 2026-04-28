import { SideNav } from "./side-nav";
import { Topbar } from "./topbar";
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
      <div
        className="flex min-h-screen flex-col bg-[var(--color-background-page)]"
        style={{ marginLeft: "var(--sidebar-width)" }}
      >
        <Topbar propertyId={propertyId} propertyNickname={propertyNickname} />
        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-7 py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
