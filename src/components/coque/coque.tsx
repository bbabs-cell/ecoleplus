'use client';

import { useEffect, useId, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Coque de l'application : barre supérieure et tiroir sur mobile, colonne
 * fixe à partir de `lg`.
 *
 * Avant, l'`aside` était simplement empilé au-dessus du contenu : sur un
 * téléphone, le premier écran n'était que du menu et la page commençait
 * sous la ligne de flottaison. Le tiroir rend l'écran au contenu.
 *
 * Les morceaux arrivent en `ReactNode` depuis la mise en page serveur : les
 * permissions continuent d'être calculées côté serveur, ce composant ne fait
 * que les disposer.
 *
 * L'écriture de droite à gauche est prise en charge par les propriétés
 * logiques (`start`) et par la variante `rtl:` du décalage : le tiroir sort du
 * bon côté en arabe comme en français.
 */
export function Coque({
  marque,
  entete,
  navigation,
  pied,
  raccourci,
  libelleOuvrir,
  libelleFermer,
  children,
}: {
  marque: React.ReactNode;
  entete: React.ReactNode;
  navigation: React.ReactNode;
  pied: React.ReactNode;
  /** Affiché dans la barre mobile, à droite du titre (avatar, etc.). */
  raccourci?: React.ReactNode;
  libelleOuvrir: string;
  libelleFermer: string;
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  const idTiroir = useId();

  // Échap referme, et le fond ne défile pas pendant que le tiroir est ouvert.
  useEffect(() => {
    if (!ouvert) return;

    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') setOuvert(false);
    };

    const defilementInitial = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', surTouche);

    return () => {
      document.body.style.overflow = defilementInitial;
      document.removeEventListener('keydown', surTouche);
    };
  }, [ouvert]);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Barre mobile : fine, collante, elle laisse la page commencer tout de suite. */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-bordure bg-surface/95 px-4 py-2 backdrop-blur-sm pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label={libelleOuvrir}
          aria-expanded={ouvert}
          aria-controls={idTiroir}
          className="-ms-2 flex size-11 shrink-0 items-center justify-center rounded-douce text-encre-douce transition-colors hover:bg-surface-2 hover:text-encre"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">{marque}</div>
        {raccourci}
      </header>

      {/* Voile : referme au toucher, invisible aux lecteurs d'écran. */}
      {ouvert ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setOuvert(false)}
          className="fixed inset-0 z-40 bg-encre/40 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}

      <aside
        id={idTiroir}
        // `inert` retire le tiroir fermé du parcours clavier : un lien
        // invisible mais focusable est un piège pour la navigation au clavier.
        inert={!ouvert ? true : undefined}
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-[min(19rem,85vw)] flex-col gap-4 overflow-y-auto',
          'border-e border-bordure bg-surface-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          ouvert ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full',
          // À partir de lg, le tiroir redevient une colonne ordinaire.
          'lg:static lg:z-auto lg:h-dvh lg:w-64 lg:translate-x-0 lg:bg-surface-2/60 lg:pb-4 rtl:lg:translate-x-0',
        )}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{marque}</div>
          <button
            type="button"
            onClick={() => setOuvert(false)}
            aria-label={libelleFermer}
            className="-me-2 flex size-11 shrink-0 items-center justify-center rounded-douce text-encre-douce transition-colors hover:bg-surface-2 hover:text-encre lg:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {entete}

        {/* Suivre un lien referme le tiroir : sans cela, le menu resterait
            ouvert par-dessus la page qu'on vient de demander. On l'écoute ici
            plutôt que dans un effet — c'est un geste de l'utilisateur, pas une
            conséquence d'un changement d'état. */}
        <div
          className="lg:flex-1"
          onClick={(evenement) => {
            if ((evenement.target as HTMLElement).closest('a')) setOuvert(false);
          }}
        >
          {navigation}
        </div>

        {pied}
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">
        {/* Pas de largeur maximale ici : chaque page pose la sienne, adaptée
            à son contenu (`max-w-3xl` pour un formulaire, `max-w-5xl` pour une
            liste). En ajouter une seconde ne contraindrait rien. */}
        {children}
      </main>
    </div>
  );
}
