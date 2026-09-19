import type { Metadata } from 'next';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { listerNiveaux, resoudreAnnee } from '@/services/academique';
import { listerClasses } from '@/services/classes';
import { listerInscriptions, repartitionStatuts } from '@/services/apprenants';
import { formaterDate, initiales, nomAffiche } from '@/lib/format';
import { Carte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { Alerte } from '@/components/ui/alerte';
import { Pagination } from '@/components/ui/pagination';
import { SelecteurAnnee } from '@/components/academique/selecteur-annee';
import { StatutInscription, libelleStatut } from '@/components/academique/statut-inscription';
import { FormulaireInscription, RechercheApprenant } from './formulaires';

export const metadata: Metadata = { title: 'Apprenants' };

export default async function PageApprenants({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; page?: string; q?: string }>;
}) {
  const contexte = await exigerEtablissement('learners.read');
  const { annee: anneeDemandee, page: pageBrute, q } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageBrute ?? '1', 10) || 1);

  const { annee, annees } = await resoudreAnnee(contexte.etablissementActif.id, anneeDemandee);
  const peutInscrire = contexte.permissions.has('enrollments.manage');
  const format = contexte.reglages.name_display_format;

  if (!annee) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-encre">Apprenants</h1>
        <Alerte ton="alerte" titre="Aucune année académique">
          Une inscription se rattache à une année.{' '}
          <Link href="/annees" className="font-medium text-primaire">
            Créez-en une d&apos;abord
          </Link>
          .
        </Alerte>
      </div>
    );
  }

  const [inscriptions, repartition, niveaux, classes] = await Promise.all([
    listerInscriptions(annee.id, page, q),
    repartitionStatuts(annee.id),
    listerNiveaux(contexte.etablissementActif.id, true),
    listerClasses(annee.id),
  ]);

  const statutsPresents = Object.entries(repartition).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-encre">Apprenants</h1>
          <p className="text-sm text-encre-douce">
            {contexte.etablissementActif.name} · {inscriptions.total} inscription
            {inscriptions.total > 1 ? 's' : ''} sur {annee.name}
          </p>
        </div>
        <SelecteurAnnee annees={annees} anneeActive={annee.id} />
      </header>

      {statutsPresents.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {statutsPresents.map(([statut, nombre]) => (
            <span
              key={statut}
              className="rounded-douce border border-bordure bg-carte px-2.5 py-1 text-xs text-encre-douce"
            >
              <span className="font-semibold tabular-nums text-encre">{nombre}</span>{' '}
              {libelleStatut(statut as Parameters<typeof libelleStatut>[0])}
            </span>
          ))}
        </div>
      ) : null}

      {peutInscrire ? (
        <FormulaireInscription
          anneeId={annee.id}
          anneeNom={annee.name}
          niveaux={niveaux}
          classes={classes.filter((classe) => classe.is_active)}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <RechercheApprenant valeur={q ?? ''} />
      </div>

      <Carte className="overflow-hidden">
        {inscriptions.lignes.length === 0 ? (
          <EtatVide
            icone={<Users className="size-8" />}
            titre={q ? 'Aucun résultat' : 'Aucun apprenant inscrit'}
            description={
              q
                ? 'Aucun apprenant ne correspond à cette recherche sur cette année.'
                : peutInscrire
                  ? `Inscrivez le premier apprenant de l'année ${annee.name}.`
                  : `Aucune inscription pour l'année ${annee.name}.`
            }
          />
        ) : (
          <>
            {inscriptions.lignes.map((inscription) => (
              <Link
                key={inscription.id}
                href={`/apprenants/${inscription.learner_id}`}
                className="flex flex-wrap items-center gap-3 border-b border-bordure p-5 transition-colors last:border-b-0 hover:bg-surface-2"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primaire-douce text-xs font-semibold text-primaire"
                  aria-hidden="true"
                >
                  {initiales(inscription.apprenant, format)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-encre">
                      {nomAffiche(inscription.apprenant, format)}
                    </p>
                    {inscription.apprenant.learner_code ? (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-encre-douce">
                        {inscription.apprenant.learner_code}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-encre-douce">
                    {[
                      inscription.niveau?.name,
                      inscription.classe?.name ?? 'Sans classe',
                      `Inscrit le ${formaterDate(inscription.enrolled_on, contexte.reglages)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>

                <StatutInscription statut={inscription.status} />
              </Link>
            ))}
            <Pagination
              page={inscriptions.page}
              pages={inscriptions.pages}
              total={inscriptions.total}
              chemin="/apprenants"
            />
          </>
        )}
      </Carte>
    </div>
  );
}
