import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList, Lock } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { listerMatieres, listerPeriodes, resoudreAnnee } from '@/services/academique';
import { listerClasses } from '@/services/classes';
import { enseignantsActifs } from '@/services/enseignants';
import { baremesUtilisables, categoriesUtilisables, listerEvaluations } from '@/services/notation';
import { formaterDate, jourCourantIso, nomAffiche } from '@/lib/format';
import { Carte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { Alerte } from '@/components/ui/alerte';
import { Etiquette } from '@/components/ui/etiquette';
import { Pagination } from '@/components/ui/pagination';
import { SelecteurAnnee } from '@/components/academique/selecteur-annee';
import { FormulaireEvaluation } from './formulaires';

export const metadata: Metadata = { title: 'Évaluations' };

const STATUTS: Record<string, { libelle: string; ton: 'neutre' | 'primaire' | 'succes' | 'alerte' | 'danger' }> = {
  DRAFT: { libelle: 'Brouillon', ton: 'neutre' },
  OPEN: { libelle: 'Saisie en cours', ton: 'primaire' },
  VERIFIED: { libelle: 'Vérifiée', ton: 'alerte' },
  PUBLISHED: { libelle: 'Publiée', ton: 'succes' },
  CANCELLED: { libelle: 'Annulée', ton: 'danger' },
};

const POLITIQUES: Record<string, string> = {
  SKIP: 'Note manquante ignorée',
  ZERO: 'Note manquante comptée zéro',
  EXCLUDED: 'Évaluation non concernée',
};

export default async function PageEvaluations({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; page?: string; classe?: string }>;
}) {
  const contexte = await exigerEtablissement('grades.read');
  const { annee: anneeDemandee, page: pageBrute, classe: classeFiltre } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageBrute ?? '1', 10) || 1);

  const { annee, annees } = await resoudreAnnee(contexte.etablissementActif.id, anneeDemandee);
  const peutCreer = contexte.permissions.has('grades.manage');
  const format = contexte.reglages.name_display_format;

  if (!annee) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-encre">Évaluations</h1>
        <Alerte ton="alerte" titre="Aucune année académique">
          Une évaluation se rattache à une année.{' '}
          <Link href="/annees" className="font-medium text-primaire">
            Créez-en une d&apos;abord
          </Link>
          .
        </Alerte>
      </div>
    );
  }

  const [evaluations, classes, matieres, baremes, categories, periodes, enseignants] =
    await Promise.all([
      listerEvaluations(annee.id, page, classeFiltre),
      listerClasses(annee.id),
      listerMatieres(contexte.etablissementActif.id, true),
      baremesUtilisables(contexte.etablissementActif.id),
      categoriesUtilisables(contexte.etablissementActif.id),
      listerPeriodes(annee.id),
      enseignantsActifs(contexte.etablissementActif.id),
    ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-encre">Évaluations</h1>
          <p className="text-sm text-encre-douce">
            {contexte.etablissementActif.name} · {evaluations.total} évaluation
            {evaluations.total > 1 ? 's' : ''} sur {annee.name}
          </p>
        </div>
        <SelecteurAnnee annees={annees} anneeActive={annee.id} />
      </header>

      {peutCreer ? (
        <FormulaireEvaluation
          anneeId={annee.id}
          anneeNom={annee.name}
          classes={classes.filter((classe) => classe.is_active)}
          matieres={matieres}
          baremes={baremes}
          categories={categories}
          periodes={periodes}
          enseignants={enseignants}
          format={format}
          dateDuJour={jourCourantIso(contexte.reglages.timezone)}
        />
      ) : null}

      <Carte className="overflow-hidden">
        {evaluations.lignes.length === 0 ? (
          <EtatVide
            icone={<ClipboardList className="size-8" />}
            titre="Aucune évaluation"
            description={
              peutCreer
                ? `Créez la première évaluation de l'année ${annee.name}.`
                : `Aucune évaluation n'est définie pour l'année ${annee.name}.`
            }
          />
        ) : (
          <>
            {evaluations.lignes.map((evaluation) => {
              const statut = STATUTS[evaluation.status] ?? STATUTS['DRAFT']!;
              const complete =
                evaluation.attendus > 0 && evaluation.saisies >= evaluation.attendus;

              return (
                <Link
                  key={evaluation.id}
                  href={`/evaluations/${evaluation.id}`}
                  className="flex flex-wrap items-center gap-3 border-b border-bordure p-5 transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-encre">{evaluation.title}</p>
                      {evaluation.matiere ? (
                        <span className="text-sm text-encre-douce">{evaluation.matiere.name}</span>
                      ) : null}
                      {evaluation.categorie ? (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-encre-douce">
                          {evaluation.categorie.name}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-encre-douce">
                      {[
                        evaluation.classe?.name,
                        formaterDate(`${evaluation.date_on}T12:00:00Z`, contexte.reglages),
                        evaluation.bareme
                          ? `${evaluation.bareme.name} · coef. ${evaluation.coefficient}`
                          : null,
                        evaluation.enseignant
                          ? nomAffiche(evaluation.enseignant, format)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="mt-0.5 text-xs text-encre-douce">
                      {POLITIQUES[evaluation.missing_grade_policy]} ·{' '}
                      <span className={complete ? 'text-succes' : undefined}>
                        {evaluation.saisies} note{evaluation.saisies > 1 ? 's' : ''} sur{' '}
                        {evaluation.attendus}
                      </span>
                    </p>
                  </div>

                  <Etiquette ton={statut.ton}>
                    {evaluation.status === 'PUBLISHED' ? (
                      <Lock className="mr-1 size-3" aria-hidden="true" />
                    ) : null}
                    {statut.libelle}
                  </Etiquette>
                </Link>
              );
            })}
            <Pagination
              page={evaluations.page}
              pages={evaluations.pages}
              total={evaluations.total}
              chemin="/evaluations"
            />
          </>
        )}
      </Carte>
    </div>
  );
}
