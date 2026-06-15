import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SidebarProvider } from './SidebarContext';
import { HeaderSlotProvider } from './HeaderSlot';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <HeaderSlotProvider>
        <div className="flex h-svh overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </HeaderSlotProvider>
    </SidebarProvider>
  );
}
