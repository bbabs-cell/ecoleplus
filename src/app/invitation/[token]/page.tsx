import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { brand } from '@/config/brand';
import { contexteSession } from '@/services/session';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { Alerte } from '@/components/ui/alerte';
import { FormulaireInvitation } from './formulaire';

export const metadata: Metadata = { title: 'Invitation' };

export default async function PageInvitation({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const contexte = await contexteSession();

  // Rien n'est révélé de l'invitation avant l'acceptation : ni l'organisation,
  // ni le rôle, ni même sa validité. Afficher ces détails renseignerait le
  // porteur d'un lien intercepté, alors qu'il ne pourra pas l'utiliser.
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-douce bg-primaire text-primaire-contraste">
          <GraduationCap className="size-5" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-encre">{brand.name}</span>
      </div>

      <Carte>
        <EnTeteCarte>
          <TitreCarte>Invitation à rejoindre une organisation</TitreCarte>
          <SousTitreCarte>
            L&apos;invitation doit correspondre à l&apos;adresse e-mail de votre compte.
          </SousTitreCarte>
        </EnTeteCarte>
        <CorpsCarte className="space-y-4">
          {contexte ? (
            <>
              <p className="text-sm text-encre-douce">
                Connecté en tant que{' '}
                <span className="font-medium text-encre">{contexte.utilisateur.email}</span>.
              </p>
              <FormulaireInvitation jeton={token} />
            </>
          ) : (
            <>
              <Alerte ton="info">
                Connectez-vous — ou créez un compte avec l&apos;adresse invitée — puis rouvrez ce
                lien.
              </Alerte>
              <div className="flex gap-2">
                <Link
                  href={`/connexion?suite=${encodeURIComponent(`/invitation/${token}`)}`}
                  className="flex h-10 flex-1 items-center justify-center rounded-douce bg-primaire px-4 text-sm font-medium text-primaire-contraste"
                >
                  Se connecter
                </Link>
                <Link
                  href="/inscription"
                  className="flex h-10 flex-1 items-center justify-center rounded-douce border border-bordure bg-carte px-4 text-sm font-medium text-encre"
                >
                  Créer un compte
                </Link>
              </div>
            </>
          )}
        </CorpsCarte>
      </Carte>
    </main>
  );
}
