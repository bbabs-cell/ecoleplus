import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { clientServeur } from '@/lib/supabase/server';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { FormulaireNouveauMotDePasse } from './formulaire';

export const metadata: Metadata = { title: 'Nouveau mot de passe' };

export default async function PageNouveauMotDePasse() {
  const supabase = await clientServeur();

  // Le proxy ferme déjà cette route aux visiteurs sans session. On revérifie
  // ici : une vérification faite à un seul endroit n'en est pas une.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/mot-de-passe-oublie?expire=1');

  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte>Nouveau mot de passe</TitreCarte>
        <SousTitreCarte>
          Choisissez un mot de passe d&rsquo;au moins douze caractères.
        </SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte>
        <FormulaireNouveauMotDePasse />
      </CorpsCarte>
    </Carte>
  );
}
