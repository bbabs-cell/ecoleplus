import type { Metadata } from 'next';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { Alerte } from '@/components/ui/alerte';
import { FormulaireMotDePasseOublie } from './formulaire';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default async function PageMotDePasseOublie({
  searchParams,
}: {
  searchParams: Promise<{ expire?: string }>;
}) {
  const { expire } = await searchParams;

  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte>Mot de passe oublié</TitreCarte>
        <SousTitreCarte>
          Indiquez votre adresse : nous vous enverrons un lien pour en choisir un nouveau.
        </SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte className="space-y-4">
        {expire ? (
          <Alerte ton="alerte">
            Ce lien n&rsquo;est plus valable — il a expiré ou il a déjà servi. Demandez-en un
            nouveau.
          </Alerte>
        ) : null}
        <FormulaireMotDePasseOublie />
      </CorpsCarte>
    </Carte>
  );
}
