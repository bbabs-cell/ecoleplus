import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * États vide et chargement.
 *
 * Chaque vue de données doit traiter explicitement chargement / erreur / vide
 * (règles de code, 10) : ces composants évitent qu'un tableau vide ressemble à
 * un écran cassé.
 */
export function EtatVide({
  titre,
  description,
  action,
  icone,
}: {
  titre: string;
  description?: string;
  action?: ReactNode;
  icone?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icone ? <div className="text-encre-douce" aria-hidden="true">{icone}</div> : null}
      <div className="space-y-1">
        <p className="font-semibold text-encre">{titre}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-encre-douce">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Squelette({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-douce bg-surface-2', className)}
      aria-hidden="true"
    />
  );
}

export function ChargementListe({ lignes = 4 }: { lignes?: number }) {
  return (
    <div className="space-y-3 p-5" role="status" aria-label="Chargement en cours">
      {Array.from({ length: lignes }, (_, index) => (
        <Squelette key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
