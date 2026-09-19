import type { Metadata } from 'next';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { FormulaireInscription } from './formulaire';

export const metadata: Metadata = { title: 'Créer un compte' };

export default function PageInscription() {
  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte>Créer un compte</TitreCarte>
        <SousTitreCarte>
          Créez votre organisation, ou rejoignez-en une sur invitation.
        </SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte>
        <FormulaireInscription />
      </CorpsCarte>
    </Carte>
  );
}
