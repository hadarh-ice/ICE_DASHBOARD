'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavbarProps {
  title: string;
  showUpload?: boolean;
  showSettings?: boolean;
  className?: string;
}

export function Navbar({
  title,
  showUpload = true,
  showSettings = true,
  className,
}: NavbarProps) {
  const router = useRouter();

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'sticky top-0 z-40',
        'bg-white/80 dark:bg-gray-900/80',
        'backdrop-blur-xl',
        'border-b border-gray-200/50 dark:border-gray-800/50',
        'md:hidden',
        className
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="flex items-center justify-between h-11 px-4">
        {/* Left Action - Upload */}
        {showUpload ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/upload')}
            className={cn(
              'flex items-center justify-center',
              'w-9 h-9 -ml-1',
              'rounded-full',
              'bg-primary/10 hover:bg-primary/20',
              'text-primary',
              'transition-colors'
            )}
            aria-label="העלאה"
          >
            <Plus className="h-5 w-5" />
          </motion.button>
        ) : (
          <div className="w-9" />
        )}

        {/* Center Title */}
        <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white">
          {title}
        </h1>

        {/* Right Action - Settings */}
        {showSettings ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/settings')}
            className={cn(
              'flex items-center justify-center',
              'w-9 h-9 -mr-1',
              'rounded-full',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'text-gray-600 dark:text-gray-400',
              'transition-colors'
            )}
            aria-label="הגדרות"
          >
            <Settings className="h-5 w-5" />
          </motion.button>
        ) : (
          <div className="w-9" />
        )}
      </div>
    </motion.header>
  );
}
