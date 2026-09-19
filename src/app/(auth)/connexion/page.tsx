import type { Metadata } from 'next';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { FormulaireConnexion } from './formulaire';

export const metadata: Metadata = { title: 'Connexion' };

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;
  // Seuls les chemins internes sont repris ; la Server Action revalide.
  const destination = suite?.startsWith('/') && !suite.startsWith('//') ? suite : '/tableau-de-bord';

  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte>Connexion</TitreCarte>
        <SousTitreCarte>Accédez à votre espace de gestion.</SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte>
        <FormulaireConnexion suite={destination} />
      </CorpsCarte>
    </Carte>
  );
}
