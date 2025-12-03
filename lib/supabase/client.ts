'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Guard against server-side execution during build
  if (typeof window === 'undefined') {
    throw new Error('createClient can only be called in the browser');
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
