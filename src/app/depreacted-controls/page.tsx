
"use client";

// This page is deprecated and its functionality has been moved to /app/controls/page.tsx
// It's kept here for historical reference but should not be used.

export default function DeprecatedControlsPage() {
  return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <h1 className="text-2xl font-bold text-destructive-foreground mb-3">Página Obsoleta</h1>
        <p className="text-lg text-card-foreground mb-4">
          Esta página de controles ya no se utiliza.
        </p>
      </div>
    );
}
