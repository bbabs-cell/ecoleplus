import type { Metadata } from 'next';
import Link from 'next/link';
import { School } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { listerMatieres, listerNiveaux, resoudreAnnee } from '@/services/academique';
import { listerAffectations, listerClasses } from '@/services/classes';
import { enseignantsActifs } from '@/services/enseignants';
import { Carte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { Alerte } from '@/components/ui/alerte';
import { SelecteurAnnee } from '@/components/academique/selecteur-annee';
import { CarteClasse, FormulaireClasse } from './formulaires';
import { TitrePage } from '@/components/ui/titre-page';

export const metadata: Metadata = { title: 'Classes' };

export default async function PageClasses({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string }>;
}) {
  const contexte = await exigerEtablissement('classes.read');
  const { annee: anneeDemandee } = await searchParams;

  const { annee, annees } = await resoudreAnnee(contexte.etablissementActif.id, anneeDemandee);
  const peutModifier = contexte.permissions.has('classes.manage');
  const format = contexte.reglages.name_display_format;

  if (!annee) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <TitrePage teinte="personnes">Classes</TitrePage>
        <Alerte ton="alerte" titre="Aucune année académique">
          Les classes se rattachent à une année.{' '}
          <Link href="/annees" className="font-medium text-primaire">
            Créez-en une d&apos;abord
          </Link>
          .
        </Alerte>
      </div>
    );
  }

  const [classes, affectations, niveaux, matieres, enseignants] = await Promise.all([
    listerClasses(annee.id),
    listerAffectations(annee.id),
    listerNiveaux(contexte.etablissementActif.id, true),
    listerMatieres(contexte.etablissementActif.id, true),
    enseignantsActifs(contexte.etablissementActif.id),
  ]);

  const affectationsParClasse = new Map<string, typeof affectations>();
  for (const affectation of affectations) {
    const liste = affectationsParClasse.get(affectation.class_id) ?? [];
    liste.push(affectation);
    affectationsParClasse.set(affectation.class_id, liste);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <TitrePage teinte="personnes">Classes</TitrePage>
          <p className="text-sm text-encre-douce">
            {contexte.etablissementActif.name} · {classes.length} classe
            {classes.length > 1 ? 's' : ''}
          </p>
        </div>
        <SelecteurAnnee annees={annees} anneeActive={annee.id} />
      </header>

      {peutModifier ? (
        <FormulaireClasse
          anneeId={annee.id}
          niveaux={niveaux}
          enseignants={enseignants}
          format={format}
        />
      ) : null}

      {classes.length === 0 ? (
        <Carte>
          <EtatVide
            icone={<School className="size-8" />}
            titre="Aucune classe"
            description={
              peutModifier
                ? `Créez les classes de l'année ${annee.name}.`
                : `Aucune classe n'est définie pour l'année ${annee.name}.`
            }
          />
        </Carte>
      ) : (
        <div className="space-y-4">
          {classes.map((classe) => (
            <CarteClasse
              key={classe.id}
              classe={classe}
              affectations={affectationsParClasse.get(classe.id) ?? []}
              niveaux={niveaux}
              enseignants={enseignants}
              matieres={matieres}
              format={format}
              peutModifier={peutModifier}
            />
          ))}
        </div>
      )}
    </div>
  );
}
