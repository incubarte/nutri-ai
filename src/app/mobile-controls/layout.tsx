
"use client";

import type { ReactNode } from 'react';

// This layout ensures the /mobile-controls page does not have the main header
// or any other complex layout structure, providing a clean canvas.
export default function MobileControlsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The main div is now here to wrap both login and controls pages.
  return (
    <div className="w-full h-full p-4 bg-background">
      {children}
    </div>
  );
}
