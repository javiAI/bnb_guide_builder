import { SideNav } from "./side-nav";
import { Topbar } from "./topbar";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { PublishingRail } from "./publishing-rail";
import { AssistantLauncher } from "./assistant-launcher";
import { NavDrawerTab, RailDrawerTab } from "./shell-chrome";
import { getDerived } from "@/lib/services/property-derived.service";
import { getPublicGuideHandoff } from "@/lib/services/public-guide-qr.service";
import {
  getOperatorNotifications,
  type OperatorNotification,
} from "@/lib/services/operator-notifications.service";
import type { SwitchableProperty } from "./property-switcher";

interface AppShellProps {
  propertyId: string;
  propertyNickname: string;
  publicSlug: string | null;
  defaultLocale: string;
  workspaceProperties: SwitchableProperty[];
  children: React.ReactNode;
}

export async function AppShell({
  propertyId,
  propertyNickname,
  publicSlug,
  defaultLocale,
  workspaceProperties,
  children,
}: AppShellProps) {
  // Independent fail-soft reads run concurrently — a cache miss or failure in
  // one must not block (or break) the navigation chrome.
  const [derived, notifications, handoff] = await Promise.all([
    getDerived(propertyId).catch(() => null),
    getOperatorNotifications(propertyId).catch(
      () => [] as OperatorNotification[],
    ),
    getPublicGuideHandoff(publicSlug).catch(() => null),
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
  const publishable = derived?.readiness?.publishable ?? false;

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
        <div className="flex-1 min-w-0 lg:ml-[var(--sidebar-width)] xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail-width,300px)]">
          <main className="min-w-0">
            <div className="mx-auto w-full max-w-[var(--content-max)] px-4 pb-16 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
          <PublishingRail
            propertyId={propertyId}
            publicUrl={handoff?.publicUrl ?? null}
            qrSvg={handoff?.qrSvg ?? null}
            overallScore={overallScore}
            publishable={publishable}
            defaultLocale={defaultLocale}
          />
        </div>
      </div>
      <NavDrawerTab />
      <RailDrawerTab />
      {/* Floating chat bubble — visible below xl, or at xl when the rail is
          collapsed (it hosts the docked chat otherwise). See shell.css. */}
      <AssistantLauncher propertyId={propertyId} defaultLocale={defaultLocale} />
    </div>
  );
}
