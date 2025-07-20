
"use client";

import type { ReactNode } from 'react';

// This layout ensures the /mobile-controls/shotsV2 page does not have the main header
// or any other complex layout structure, providing a clean canvas.
export default function MobileShotsV2Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
