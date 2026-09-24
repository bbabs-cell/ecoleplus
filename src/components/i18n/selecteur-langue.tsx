'use client';

import { useActionState } from 'react';
import { Languages } from 'lucide-react';
import { definirLangueAction } from '@/i18n/langue.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import { LOCALES, NOMS_LOCALES, type Locale } from '@/i18n/locales';

/**
 * Choix de la langue d'interface.
 *
 * Soumission au changement, sans bouton : choisir une langue et devoir ensuite
 * valider est une étape de trop. Le `<noscript>` n'est pas nécessaire — le
 * formulaire reste soumettable au clavier par la touche Entrée.
 */
export function SelecteurLangue({ locale }: { locale: Locale }) {
  const [etat, action] = useActionState(definirLangueAction, ETAT_INITIAL);

  return (
    <form action={action} className="flex items-center gap-2">
      <Languages className="size-4 shrink-0 text-encre-douce" aria-hidden="true" />
      <label htmlFor="langue" className="sr-only">
        Langue de l&apos;interface
      </label>
      <select
        id="langue"
        name="langue"
        defaultValue={locale}
        onChange={(evenement) => evenement.currentTarget.form?.requestSubmit()}
        className="min-h-9 w-full rounded-douce border border-bordure bg-carte px-2 py-1 text-xs text-encre"
      >
        {LOCALES.map((valeur) => (
          <option key={valeur} value={valeur}>
            {NOMS_LOCALES[valeur]}
          </option>
        ))}
      </select>
      {etat.statut === 'erreur' ? (
        <span className="sr-only" role="alert">
          {etat.message}
        </span>
      ) : null}
    </form>
  );
}
