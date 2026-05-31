import { SideNav } from "./side-nav";
import { Topbar } from "./topbar";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { PublishingRail } from "./publishing-rail";
import { NavDrawerTab, RailDrawerTab } from "./shell-chrome";
import { getDerived } from "@/lib/services/property-derived.service";
import {
  getOperatorNotifications,
  type OperatorNotification,
} from "@/lib/services/operator-notifications.service";
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
  // Independent fail-soft reads run concurrently — a cache miss or failure in
  // one must not block (or break) the navigation chrome.
  const [derived, notifications] = await Promise.all([
    getDerived(propertyId).catch(() => null),
    getOperatorNotifications(propertyId).catch(
      () => [] as OperatorNotification[],
    ),
  ]);

  let sectionScores: Record<string, number> | undefined;
  let overallScore: number | undefined;
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
    overallScore = derived.readiness.overall;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-background-page)]">
      <Topbar
        propertyId={propertyId}
        propertyNickname={propertyNickname}
        notifications={notifications}
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
        <div className="shell-content-grid flex-1 min-w-0 lg:ml-[var(--sidebar-width)] xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail-width,300px)]">
          <main className="min-w-0">
            <div className="mx-auto w-full max-w-[var(--content-max)] px-4 pb-16 sm:px-6 lg:px-8">
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
      <NavDrawerTab />
      <RailDrawerTab />
    </div>
  );
}
