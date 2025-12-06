'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, BarChart3, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Header() {
  const router = useRouter();
  const [supabase] = useState(() => {
    if (typeof window !== 'undefined') {
      return createClient();
    }
    return null;
  });

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-header">
      {/* Glass background */}
      <div className="absolute inset-0 glass-strong border-b border-border/50" />

      {/* Content */}
      <div className="relative h-full container flex items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <span className="font-bold text-lg hidden sm:inline">ICE Analytics</span>
          <span className="font-bold text-lg sm:hidden">ICE</span>
        </motion.div>

        {/* Desktop Navigation & Actions */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* Settings - hidden on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex h-9 w-9"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* Logout button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={cn(
              "h-9 px-3 gap-2",
              "text-muted-foreground hover:text-foreground"
            )}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">התנתק</span>
          </Button>
        </motion.div>
      </div>
    </header>
  );
}
