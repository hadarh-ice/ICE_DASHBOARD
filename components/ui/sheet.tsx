'use client';

import * as React from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModal } from '@/contexts/ModalContext';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  height?: 'auto' | 'half' | 'full';
  showHandle?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

export function Sheet({
  isOpen,
  onClose,
  children,
  title,
  height = 'auto',
  showHandle = true,
  showCloseButton = true,
  className,
}: SheetProps) {
  const [dragY, setDragY] = React.useState(0);
  const { setModalOpen } = useModal();

  const heightClasses = {
    auto: 'max-h-[85vh]',
    half: 'h-[50vh]',
    full: 'h-[calc(100vh-44px)]',
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
    setDragY(0);
  };

  // Notify modal context when sheet opens/closes
  React.useEffect(() => {
    setModalOpen(isOpen);
    return () => {
      setModalOpen(false);
    };
  }, [isOpen, setModalOpen]);

  // Prevent body scroll when sheet is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: dragY }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDrag={(_, info) => setDragY(Math.max(0, info.offset.y))}
            onDragEnd={handleDragEnd}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-[60]',
              'bg-white dark:bg-gray-900',
              'rounded-t-[20px]',
              'shadow-[0_-4px_20px_rgba(0,0,0,0.15)]',
              'flex flex-col',
              'overflow-hidden',
              heightClasses[height],
              className
            )}
            style={{
              paddingBottom: 'env(safe-area-inset-bottom)',
              touchAction: 'none'
            }}
          >
            {/* Drag Handle */}
            {showHandle && (
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                )}
                {title && (
                  <h2 className="text-lg font-semibold text-center flex-1">
                    {title}
                  </h2>
                )}
                {showCloseButton && <div className="w-9" />}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Sheet Footer for action buttons
interface SheetFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function SheetFooter({ children, className }: SheetFooterProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-[70]',
        'flex gap-3 p-4',
        'border-t border-gray-100 dark:border-gray-800',
        'bg-white dark:bg-gray-900',
        className
      )}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      {children}
    </div>
  );
}

// Sheet Content wrapper
interface SheetContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SheetContent({ children, className }: SheetContentProps) {
  return (
    <div className={cn('px-4 py-4', className)}>
      {children}
    </div>
  );
}
