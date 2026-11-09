import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { KeyboardShortcuts } from "./KeyboardShortcuts";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-ink-50">
      <KeyboardShortcuts />
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <MobileNav />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
