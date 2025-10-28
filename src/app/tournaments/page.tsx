
"use client";

import { Trophy } from 'lucide-react';

export default function TournamentsPage() {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 py-10">
      <div className="flex flex-col items-center text-center">
        <Trophy className="h-16 w-16 text-primary mb-4" />
        <h1 className="text-4xl font-bold">Gestión de Torneos</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Próximamente: Crea, edita y gestiona tus torneos aquí.
        </p>
      </div>

      {/* Placeholder for future content */}
      <div className="border-2 border-dashed rounded-lg p-12 text-center">
        <p className="text-muted-foreground">El contenido para la gestión de torneos aparecerá aquí.</p>
      </div>
    </div>
  );
}
