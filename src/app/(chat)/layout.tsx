'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { useCrossTabSync } from '@/hooks/use-cross-tab-sync';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useCrossTabSync();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
