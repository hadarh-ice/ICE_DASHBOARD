'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Upload, Users, FileBarChart, Settings, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    title: 'לוח בקרה',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'סקירה כללית',
  },
  {
    title: 'העלאת קבצים',
    href: '/upload',
    icon: Upload,
    description: 'שעות ומאמרים',
  },
  {
    title: 'עובדים',
    href: '/employees',
    icon: Users,
    description: 'ניהול צוות',
  },
  {
    title: 'דוחות',
    href: '/reports',
    icon: FileBarChart,
    description: 'ייצוא נתונים',
  },
  {
    title: 'הגדרות',
    href: '/settings',
    icon: Settings,
    description: 'ניהול הגדרות המערכת',
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:block fixed right-0 top-header z-30 h-[calc(100vh-theme(spacing.header))] w-56 border-l bg-background/50 backdrop-blur-sm">
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href;

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Link
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary-foreground/20'
                      : 'bg-muted group-hover:bg-background'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.title}</div>
                  <div
                    className={cn(
                      'text-[10px] truncate',
                      isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}
                  >
                    {item.description}
                  </div>
                </div>
                <ChevronLeft
                  className={cn(
                    'h-4 w-4 transition-transform',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
                  )}
                />
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-4 left-3 right-3">
        <div className="p-3 rounded-xl bg-muted/50 text-center">
          <p className="text-[10px] text-muted-foreground">ICE Analytics v1.0</p>
        </div>
      </div>
    </aside>
  );
}
