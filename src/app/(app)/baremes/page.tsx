import type { Metadata } from 'next';
import { Scale } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { listerMatieres, resoudreAnnee } from '@/services/academique';
import { listerClasses } from '@/services/classes';
import {
  anomaliesDuBareme,
  baremesUtilisables,
  categoriesUtilisables,
  coefficientsDeLaClasse,
  toutesLesTranches,
} from '@/services/notation';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import {
  CarteBareme,
  FormulaireBareme,
  FormulaireCategorie,
  FormulaireCoefficients,
} from './formulaires';
import { TitrePage } from '@/components/ui/titre-page';

export const metadata: Metadata = { title: 'Barèmes' };

export default async function PageBaremes({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; classe?: string }>;
}) {
  const contexte = await exigerEtablissement('grades.read');
  const { annee: anneeDemandee, classe: classeId } = await searchParams;

  const peutConfigurer = contexte.permissions.has('grades.configure');
  const { annee } = await resoudreAnnee(contexte.etablissementActif.id, anneeDemandee);

  const [baremes, categories, matieres] = await Promise.all([
    baremesUtilisables(contexte.etablissementActif.id),
    categoriesUtilisables(contexte.etablissementActif.id),
    listerMatieres(contexte.etablissementActif.id, true),
  ]);

  const tranches = await toutesLesTranches(baremes.map((b) => b.id));

  // Le contrôle de cohérence se fait ici, à froid — pas au moment du bulletin.
  const anomalies = new Map(
    await Promise.all(
      baremes.map(async (bareme) => [bareme.id, await anomaliesDuBareme(bareme.id)] as const),
    ),
  );

  const classes = annee ? await listerClasses(annee.id) : [];
  const coefficients = classeId ? await coefficientsDeLaClasse(classeId) : [];
  const baremeClasse = classes.find((classe) => classe.id === classeId)?.grading_system_id ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <TitrePage teinte="notation">Barèmes</TitrePage>
        <p className="text-sm text-encre-douce">
          {contexte.etablissementActif.name} · {baremes.length} barème
          {baremes.length > 1 ? 's' : ''}, {categories.length} catégorie
          {categories.length > 1 ? 's' : ''}
        </p>
      </header>

      {peutConfigurer ? <FormulaireBareme /> : null}

      {baremes.length === 0 ? (
        <Carte>
          <EtatVide
            icone={<Scale className="size-8" />}
            titre="Aucun barème"
            description="Définissez au moins un barème avant de créer des évaluations."
          />
        </Carte>
      ) : (
        <div className="space-y-4">
          {baremes.map((bareme) => (
            <CarteBareme
              key={bareme.id}
              bareme={bareme}
              tranches={tranches.get(bareme.id) ?? []}
              anomalies={anomalies.get(bareme.id) ?? []}
              peutModifier={peutConfigurer}
            />
          ))}
        </div>
      )}

      <Carte>
        <EnTeteCarte>
          <TitreCarte>Catégories d&apos;évaluation</TitreCarte>
          <SousTitreCarte>
            Contrôle continu, devoir surveillé, examen… chaque catégorie porte un poids qui
            s&apos;applique à la moyenne de matière.
          </SousTitreCarte>
        </EnTeteCarte>
        <CorpsCarte className="space-y-4">
          {categories.length > 0 ? (
            <ul className="space-y-1.5">
              {categories.map((categorie) => (
                <li
                  key={categorie.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-douce border border-bordure px-3 py-2 text-sm"
                >
                  <span className="font-medium text-encre">{categorie.name}</span>
                  <span className="tabular-nums text-encre-douce">poids {categorie.weight}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-encre-douce">Aucune catégorie définie.</p>
          )}

          {peutConfigurer ? <FormulaireCategorie /> : null}
        </CorpsCarte>
      </Carte>

      {peutConfigurer && classes.length > 0 ? (
        <Carte>
          <EnTeteCarte>
            <TitreCarte>Coefficients de matière</TitreCarte>
            <SousTitreCarte>
              Le poids de chaque matière dans la moyenne générale d&apos;une classe.
            </SousTitreCarte>
          </EnTeteCarte>
          <CorpsCarte>
            <FormulaireCoefficients
              classes={classes.filter((classe) => classe.is_active)}
              matieres={matieres}
              baremes={baremes}
              classeActive={classeId ?? ''}
              coefficients={coefficients}
              baremeClasse={baremeClasse}
            />
          </CorpsCarte>
        </Carte>
      ) : null}
    </div>
  );
}
