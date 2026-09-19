'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarRange } from 'lucide-react';

interface AnneeSimple {
  id: string;
  name: string;
  is_current: boolean;
}

/**
 * Choix de l'année de travail d'un écran.
 *
 * L'année voyage dans l'URL : la page reste partageable et le retour arrière
 * fonctionne. Contrairement à l'établissement actif, aucun droit n'en dépend —
 * c'est un simple filtre, et RLS reste seul juge de ce qui est visible.
 */
export function SelecteurAnnee({
  annees,
  anneeActive,
}: {
  annees: AnneeSimple[];
  anneeActive: string | null;
}) {
  const router = useRouter();
  const parametres = useSearchParams();

  if (annees.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-douce border border-bordure bg-carte px-2.5 py-1.5">
      <CalendarRange className="size-4 shrink-0 text-encre-douce" aria-hidden="true" />
      <label htmlFor="selecteur-annee" className="sr-only">
        Année académique
      </label>
      <select
        id="selecteur-annee"
        value={anneeActive ?? ''}
        onChange={(evenement) => {
          const suivants = new URLSearchParams(parametres.toString());
          suivants.set('annee', evenement.target.value);
          // La pagination d'une autre année n'a aucun sens.
          suivants.delete('page');
          router.push(`?${suivants.toString()}`);
        }}
        className="bg-transparent text-sm font-medium text-encre outline-none"
      >
        {annees.map((annee) => (
          <option key={annee.id} value={annee.id}>
            {annee.name}
            {annee.is_current ? ' · en cours' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
