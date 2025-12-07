'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, FileBarChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModal } from '@/contexts/ModalContext';

const navItems = [
  {
    title: 'דוחות',
    href: '/reports',
    icon: FileBarChart,
  },
  {
    title: 'לוח בקרה',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'עובדים',
    href: '/employees',
    icon: Users,
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const { isModalOpen } = useModal();

  return (
    <motion.nav
      initial={false}
      animate={{
        y: isModalOpen ? 100 : 0,
        opacity: isModalOpen ? 0 : 1,
      }}
      transition={{
        type: 'spring',
        damping: 25,
        stiffness: 300,
      }}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 md:hidden',
        isModalOpen && 'pointer-events-none'
      )}
    >
      {/* Glass background */}
      <div
        className={cn(
          'absolute inset-0',
          'bg-white/90 dark:bg-gray-900/90',
          'backdrop-blur-xl',
          'border-t border-gray-200/50 dark:border-gray-800/50'
        )}
      />

      {/* Nav content */}
      <div
        className="relative flex items-stretch justify-around"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          minHeight: '49px'
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center py-2"
            >
              <motion.div
                className="flex flex-col items-center justify-center gap-0.5"
                whileTap={{ scale: 0.92 }}
                transition={{ duration: 0.1 }}
              >
                <div className="relative">
                  <item.icon
                    className={cn(
                      'h-6 w-6 transition-colors duration-200',
                      isActive
                        ? 'text-primary'
                        : 'text-gray-400 dark:text-gray-500'
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span
                  className={cn(
                    'text-[10px] transition-colors duration-200',
                    isActive
                      ? 'text-primary font-semibold'
                      : 'text-gray-400 dark:text-gray-500 font-medium'
                  )}
                >
                  {item.title}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
