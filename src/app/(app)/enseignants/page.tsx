import type { Metadata } from 'next';
import { GraduationCap } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { listerEnseignants } from '@/services/enseignants';
import { Carte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { Pagination } from '@/components/ui/pagination';
import { FormulaireEnseignant, LigneEnseignant } from './formulaires';

export const metadata: Metadata = { title: 'Enseignants' };

export default async function PageEnseignants({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const contexte = await exigerEtablissement('teachers.read');
  const { page: pageBrute } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageBrute ?? '1', 10) || 1);

  const peutModifier = contexte.permissions.has('teachers.manage');
  const resultats = await listerEnseignants(contexte.etablissementActif.id, page);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-encre">Enseignants</h1>
        <p className="text-sm text-encre-douce">
          {contexte.etablissementActif.name} · une fiche existe indépendamment d&apos;un compte
          applicatif.
        </p>
      </header>

      {peutModifier ? <FormulaireEnseignant /> : null}

      <Carte className="overflow-hidden">
        {resultats.lignes.length === 0 ? (
          <EtatVide
            icone={<GraduationCap className="size-8" />}
            titre="Aucun enseignant"
            description={
              peutModifier
                ? 'Ajoutez les enseignants : ils pourront ensuite être affectés aux classes et aux matières.'
                : 'Aucun enseignant n’est enregistré dans cet établissement.'
            }
          />
        ) : (
          <>
            {resultats.lignes.map((enseignant) => (
              <LigneEnseignant
                key={enseignant.id}
                enseignant={enseignant}
                format={contexte.reglages.name_display_format}
                peutModifier={peutModifier}
              />
            ))}
            <Pagination
              page={resultats.page}
              pages={resultats.pages}
              total={resultats.total}
              chemin="/enseignants"
            />
          </>
        )}
      </Carte>
    </div>
  );
}
