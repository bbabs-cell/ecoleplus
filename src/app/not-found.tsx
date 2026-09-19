import Link from 'next/link';
import { Carte, CorpsCarte } from '@/components/ui/carte';

export default function PageIntrouvable() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Carte className="w-full max-w-md">
        <CorpsCarte className="space-y-4 text-center">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-encre">Page introuvable</h1>
            <p className="text-sm text-encre-douce">
              Cette page n&apos;existe pas, ou ne vous est pas accessible.
            </p>
          </div>
          <Link
            href="/tableau-de-bord"
            className="inline-flex h-10 items-center justify-center rounded-douce bg-primaire px-4 text-sm font-medium text-primaire-contraste"
          >
            Retour au tableau de bord
          </Link>
        </CorpsCarte>
      </Carte>
    </main>
  );
}
