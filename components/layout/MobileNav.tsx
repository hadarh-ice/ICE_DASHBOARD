'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Upload, Users, FileBarChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navItemVariants } from '@/lib/animations';

const navItems = [
  {
    title: 'לוח בקרה',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'העלאה',
    href: '/upload',
    icon: Upload,
  },
  {
    title: 'עובדים',
    href: '/employees',
    icon: Users,
  },
  {
    title: 'דוחות',
    href: '/reports',
    icon: FileBarChart,
  },
  {
    title: 'הגדרות',
    href: '/settings',
    icon: Settings,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Glass background */}
      <div className="absolute inset-0 glass-strong border-t border-border/50" />

      {/* Nav content */}
      <div
        className="relative flex items-center justify-around h-nav"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center h-full"
            >
              <motion.div
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-touch min-h-touch',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                variants={navItemVariants}
                initial="inactive"
                animate={isActive ? 'active' : 'inactive'}
                whileTap="tap"
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {isActive && (
                    <motion.div
                      className="absolute -bottom-1 left-1/2 w-1 h-1 bg-primary rounded-full"
                      layoutId="navIndicator"
                      style={{ x: '-50%' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.title}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
