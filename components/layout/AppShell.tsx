'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { pageVariants } from '@/lib/animations';
import { ModalProvider } from '@/contexts/ModalContext';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <ModalProvider>
      <div className="min-h-screen bg-background">
        {/* Header - always visible */}
        <Header />

        {/* Desktop Sidebar - hidden on mobile */}
        <Sidebar />

        {/* Main content area */}
        <main className="md:pr-56 pt-header pb-20 md:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className="content-area min-h-[calc(100vh-var(--header-height)-5rem)] md:min-h-[calc(100vh-var(--header-height))]"
            >
              <div className="container px-4 py-6 md:px-6 md:py-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
                {children}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Navigation - visible only on mobile */}
        <MobileNav />
      </div>
    </ModalProvider>
  );
}
