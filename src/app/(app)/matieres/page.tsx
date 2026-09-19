import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { listerMatieres } from '@/services/academique';
import { Carte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { FormulaireMatiere, LigneMatiere } from './formulaires';

export const metadata: Metadata = { title: 'Matières' };

export default async function PageMatieres() {
  const contexte = await exigerEtablissement('academic.read');
  const peutModifier = contexte.permissions.has('academic.manage');
  const matieres = await listerMatieres(contexte.etablissementActif.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-encre">Matières</h1>
        <p className="text-sm text-encre-douce">
          {contexte.etablissementActif.name} · enseignements dispensés dans cet établissement.
        </p>
      </header>

      {peutModifier ? <FormulaireMatiere /> : null}

      <Carte className="overflow-hidden">
        {matieres.length === 0 ? (
          <EtatVide
            icone={<BookOpen className="size-8" />}
            titre="Aucune matière"
            description={
              peutModifier
                ? 'Créez les matières enseignées : elles serviront aux affectations puis aux notes.'
                : 'Aucune matière n’a encore été définie.'
            }
          />
        ) : (
          matieres.map((matiere) => (
            <LigneMatiere key={matiere.id} matiere={matiere} peutModifier={peutModifier} />
          ))
        )}
      </Carte>
    </div>
  );
}
