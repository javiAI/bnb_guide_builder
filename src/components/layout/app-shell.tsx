import { SideNav } from "./side-nav";
import { Topbar } from "./topbar";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { PublishingRail } from "./publishing-rail";
import { getDerived } from "@/lib/services/property-derived.service";
import type { SwitchableProperty } from "./property-switcher";

interface AppShellProps {
  propertyId: string;
  propertyNickname: string;
  publicSlug: string | null;
  workspaceProperties: SwitchableProperty[];
  children: React.ReactNode;
}

export async function AppShell({
  propertyId,
  propertyNickname,
  publicSlug,
  workspaceProperties,
  children,
}: AppShellProps) {
  let sectionScores: Record<string, number> | undefined;
  let overallScore: number | undefined;
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
      overallScore = derived?.readiness?.overall;
    }
  } catch {
    sectionScores = undefined;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-background-page)]">
      <Topbar
        propertyId={propertyId}
        propertyNickname={propertyNickname}
        mobileNavSlot={
          <MobileNavDrawer
            propertyId={propertyId}
            propertyNickname={propertyNickname}
            sectionScores={sectionScores}
            workspaceProperties={workspaceProperties}
          />
        }
      />
      <div className="flex flex-1 min-h-0">
        <SideNav
          propertyId={propertyId}
          propertyNickname={propertyNickname}
          sectionScores={sectionScores}
          workspaceProperties={workspaceProperties}
        />
        <div className="flex-1 min-w-0 lg:ml-[var(--sidebar-width)] xl:grid xl:grid-cols-[minmax(0,1fr)_300px]">
          <main className="min-w-0">
            <div className="mx-auto max-w-4xl px-7 py-7">
              {children}
            </div>
          </main>
          <PublishingRail
            propertyId={propertyId}
            publicSlug={publicSlug}
            sectionScores={sectionScores}
            overallScore={overallScore}
          />
        </div>
      </div>
    </div>
  );
}
