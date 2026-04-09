import { SideNav } from "./side-nav";

interface AppShellProps {
  propertyId: string;
  propertyNickname: string;
  children: React.ReactNode;
}

export function AppShell({ propertyId, propertyNickname, children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <SideNav propertyId={propertyId} propertyNickname={propertyNickname} />
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
