'use client';

import { useRef } from 'react';
import { Building2 } from 'lucide-react';
import { choisirEtablissementActifAction } from '@/services/etablissements.actions';

interface EtablissementSimple {
  id: string;
  name: string;
}

/**
 * Choix de l'établissement de travail.
 *
 * La sélection part au serveur, qui vérifie que l'établissement fait bien
 * partie des accès de l'utilisateur avant de le retenir. Le `<form>` reste
 * fonctionnel sans JavaScript.
 */
export function SelecteurEtablissement({
  etablissements,
  actifId,
}: {
  etablissements: EtablissementSimple[];
  actifId: string | null;
}) {
  const formulaire = useRef<HTMLFormElement>(null);

  if (etablissements.length === 0) return null;

  // Un seul établissement : un intitulé suffit, une liste déroulante à une
  // entrée n'apporte rien.
  if (etablissements.length === 1) {
    const seul = etablissements[0];
    return (
      <div className="flex items-center gap-2 rounded-douce border border-bordure bg-carte px-3 py-2 text-sm">
        <Building2 className="size-4 shrink-0 text-encre-douce" aria-hidden="true" />
        <span className="truncate font-medium text-encre">{seul?.name}</span>
      </div>
    );
  }

  return (
    <form action={choisirEtablissementActifAction} ref={formulaire}>
      <label htmlFor="etablissementId" className="sr-only">
        Établissement actif
      </label>
      <div className="flex items-center gap-2 rounded-douce border border-bordure bg-carte px-2.5 py-1.5">
        <Building2 className="size-4 shrink-0 text-encre-douce" aria-hidden="true" />
        <select
          id="etablissementId"
          name="etablissementId"
          defaultValue={actifId ?? ''}
          onChange={() => formulaire.current?.requestSubmit()}
          className="w-full bg-transparent text-sm font-medium text-encre outline-none"
        >
          {etablissements.map((etablissement) => (
            <option key={etablissement.id} value={etablissement.id}>
              {etablissement.name}
            </option>
          ))}
        </select>
      </div>
      <noscript>
        <button type="submit" className="mt-1 text-xs underline">
          Changer
        </button>
      </noscript>
    </form>
  );
}
