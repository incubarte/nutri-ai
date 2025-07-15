
"use client";

import type { ReactNode } from 'react';

// This layout ensures the /mobile-controls page does not have the main header
// or any other complex layout structure, providing a clean canvas.
// PageShell in the root layout handles the conditional rendering.
export default function MobileControlsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
