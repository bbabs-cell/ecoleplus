'use client';

import { useEffect } from 'react';
import { Bouton } from '@/components/ui/bouton';
import { Carte, CorpsCarte } from '@/components/ui/carte';

/**
 * Écran d'erreur.
 *
 * Aucun détail technique n'est montré : ni message d'exception, ni pile, ni nom
 * de table. Le `digest` permet de retrouver la trace côté serveur sans rien
 * divulguer à l'utilisateur (règles de code, 9).
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ecoleplus] erreur de rendu', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Carte className="w-full max-w-md">
        <CorpsCarte className="space-y-4 text-center">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-encre">Une erreur est survenue</h1>
            <p className="text-sm text-encre-douce">
              L&apos;opération n&apos;a pas pu aboutir. Réessayez ; si le problème persiste,
              signalez-le à un administrateur.
            </p>
          </div>
          {error.digest ? (
            <p className="font-mono text-xs text-encre-douce">Référence : {error.digest}</p>
          ) : null}
          <Bouton onClick={reset}>Réessayer</Bouton>
        </CorpsCarte>
      </Carte>
    </main>
  );
}
