'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { AcademicTerm, Classe } from '@/lib/types/database';
import { Champ, Liste } from '@/components/ui/champ';

/**
 * Choix de la classe et de la période.
 *
 * Navigation par URL : la page reste partageable et le retour arrière
 * fonctionne. « Année entière » est une option légitime, pas un défaut caché.
 */
export function SelecteursBulletin({
  classes,
  periodes,
  classeActive,
  periodeActive,
}: {
  classes: Pick<Classe, 'id' | 'name'>[];
  periodes: AcademicTerm[];
  classeActive: string;
  periodeActive: string;
}) {
  const router = useRouter();
  const parametres = useSearchParams();

  const naviguer = (cle: string, valeur: string) => {
    const suivants = new URLSearchParams(parametres.toString());
    if (valeur) suivants.set(cle, valeur);
    else suivants.delete(cle);
    router.push(`/bulletins?${suivants.toString()}`);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Champ label="Classe" htmlFor="classe">
        <Liste
          id="classe"
          value={classeActive}
          onChange={(evenement) => naviguer('classe', evenement.target.value)}
        >
          <option value="">Sélectionnez une classe</option>
          {classes.map((classe) => (
            <option key={classe.id} value={classe.id}>
              {classe.name}
            </option>
          ))}
        </Liste>
      </Champ>

      <Champ label="Période" htmlFor="periode">
        <Liste
          id="periode"
          value={periodeActive}
          onChange={(evenement) => naviguer('periode', evenement.target.value)}
        >
          <option value="">Année entière</option>
          {periodes.map((periode) => (
            <option key={periode.id} value={periode.id}>
              {periode.name}
            </option>
          ))}
        </Liste>
      </Champ>
    </div>
  );
}
