import React, { Suspense } from 'react';
import ConfigPageContent from './page-content';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';

export default function ConfigPage() {
  return (
    <Suspense fallback={<div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4"><HockeyPuckSpinner className="h-24 w-24 text-primary mb-4" /><p className="text-xl text-foreground">Cargando configuración...</p></div>}>
      <ConfigPageContent />
    </Suspense>
  );
}
