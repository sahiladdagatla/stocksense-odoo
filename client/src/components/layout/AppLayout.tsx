import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { PageTransition } from '@/components/common/PageTransition';
import { Logo } from '@/components/common/Logo';
import { useLiveUpdates } from '@/hooks/useLiveUpdates';
import { useAuth } from '@/providers/auth';
import { Sidebar, SidebarNav, SidebarUserCard } from './Sidebar';
import { MobileSearch, TopNav, WarehouseSwitcher } from './TopNav';

export function AppLayout() {
  const { status } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useLiveUpdates(status === 'authenticated');

  return (
    <div className="min-h-svh bg-background">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-plum px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <TopNav onOpenMenu={() => setMenuOpen(true)} />
      <MobileSearch />
      <div className="flex">
        <Sidebar />
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="flex w-72 flex-col gap-0 bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-16 items-center border-b border-divider px-4">
              <Logo />
            </div>
            <div className="border-b border-divider p-3 md:hidden">
              <WarehouseSwitcher />
            </div>
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
            <SidebarUserCard onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <main id="main" className="min-w-0 flex-1 px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto max-w-[1400px]">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}
