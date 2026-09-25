import type { Metadata } from 'next';
import { Layers } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { listerNiveaux } from '@/services/academique';
import { Carte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { FormulaireNiveau, LigneNiveau } from './formulaires';
import { TitrePage } from '@/components/ui/titre-page';

export const metadata: Metadata = { title: 'Niveaux' };

export default async function PageNiveaux() {
  const contexte = await exigerEtablissement('academic.read');
  const peutModifier = contexte.permissions.has('academic.manage');
  const niveaux = await listerNiveaux(contexte.etablissementActif.id);

  const rangSuivant = niveaux.reduce((max, niveau) => Math.max(max, niveau.position), 0) + 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <TitrePage teinte="academique">Niveaux</TitrePage>
        <p className="text-sm text-encre-douce">
          {contexte.etablissementActif.name} · CP, sixième, Year 4, Licence 1 — le nom est libre,
          seul le rang fixe la progression.
        </p>
      </header>

      {peutModifier ? <FormulaireNiveau rangDefaut={rangSuivant} /> : null}

      <Carte className="overflow-hidden">
        {niveaux.length === 0 ? (
          <EtatVide
            icone={<Layers className="size-8" />}
            titre="Aucun niveau"
            description={
              peutModifier
                ? 'Définissez les niveaux de votre établissement : les classes s’y rattacheront.'
                : 'Aucun niveau n’a encore été défini.'
            }
          />
        ) : (
          niveaux.map((niveau) => (
            <LigneNiveau key={niveau.id} niveau={niveau} peutModifier={peutModifier} />
          ))
        )}
      </Carte>
    </div>
  );
}
