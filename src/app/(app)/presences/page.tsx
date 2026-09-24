import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardCheck, Lock } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { listerMatieres, resoudreAnnee } from '@/services/academique';
import { listerClasses } from '@/services/classes';
import { enseignantsActifs } from '@/services/enseignants';
import { listerSeances } from '@/services/presences';
import { formaterDate, formaterHeure, jourCourantIso, nomAffiche } from '@/lib/format';
import { Carte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { Alerte } from '@/components/ui/alerte';
import { Etiquette } from '@/components/ui/etiquette';
import { Pagination } from '@/components/ui/pagination';
import { SelecteurAnnee } from '@/components/academique/selecteur-annee';
import { FormulaireSeance } from './formulaires';

export const metadata: Metadata = { title: 'Présences' };

export default async function PagePresences({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; page?: string }>;
}) {
  const contexte = await exigerEtablissement('attendance.read');
  const { annee: anneeDemandee, page: pageBrute } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageBrute ?? '1', 10) || 1);

  const { annee, annees } = await resoudreAnnee(contexte.etablissementActif.id, anneeDemandee);
  const peutSaisir = contexte.permissions.has('attendance.record');
  const format = contexte.reglages.name_display_format;

  if (!annee) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-encre">Présences</h1>
        <Alerte ton="alerte" titre="Aucune année académique">
          Une séance d&apos;appel se rattache à une année.{' '}
          <Link href="/annees" className="font-medium text-primaire">
            Créez-en une d&apos;abord
          </Link>
          .
        </Alerte>
      </div>
    );
  }

  const [seances, classes, matieres, enseignants] = await Promise.all([
    listerSeances(annee.id, page),
    listerClasses(annee.id),
    listerMatieres(contexte.etablissementActif.id, true),
    enseignantsActifs(contexte.etablissementActif.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-encre">Présences</h1>
          <p className="text-sm text-encre-douce">
            {contexte.etablissementActif.name} · {seances.total} séance
            {seances.total > 1 ? 's' : ''} sur {annee.name}
          </p>
        </div>
        <SelecteurAnnee annees={annees} anneeActive={annee.id} />
      </header>

      {peutSaisir ? (
        <FormulaireSeance
          anneeId={annee.id}
          anneeNom={annee.name}
          classes={classes.filter((classe) => classe.is_active)}
          matieres={matieres}
          enseignants={enseignants}
          format={format}
          dateDuJour={jourCourantIso(contexte.reglages.timezone)}
        />
      ) : null}

      <Carte className="overflow-hidden">
        {seances.lignes.length === 0 ? (
          <EtatVide
            icone={<ClipboardCheck className="size-8" />}
            titre="Aucune séance"
            description={
              peutSaisir
                ? `Ouvrez la première feuille d'appel de l'année ${annee.name}.`
                : `Aucun appel n'a été fait sur l'année ${annee.name}.`
            }
          />
        ) : (
          <>
            {seances.lignes.map((seance) => {
              const close = seance.status === 'VALIDATED';
              const horaire = [formaterHeure(seance.starts_at), formaterHeure(seance.ends_at)]
                .filter(Boolean)
                .join(' – ');

              return (
                <Link
                  key={seance.id}
                  href={`/presences/${seance.id}`}
                  className="flex flex-wrap items-center gap-3 border-b border-bordure p-5 transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-encre">
                        {seance.classe?.name ?? 'Classe supprimée'}
                      </p>
                      {seance.matiere ? (
                        <span className="text-sm text-encre-douce">{seance.matiere.name}</span>
                      ) : null}
                      {seance.kind_label ? (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-encre-douce">
                          {seance.kind_label}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-encre-douce">
                      {[
                        formaterDate(`${seance.date_on}T12:00:00Z`, contexte.reglages),
                        horaire,
                        seance.enseignant ? nomAffiche(seance.enseignant, format) : null,
                        `${seance.appeles} pointé${seance.appeles > 1 ? 's' : ''}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  {close ? (
                    <Etiquette ton="succes">
                      <Lock className="me-1 size-3" aria-hidden="true" />
                      Validée
                    </Etiquette>
                  ) : (
                    <Etiquette ton={seance.appeles > 0 ? 'primaire' : 'alerte'}>
                      {seance.appeles > 0 ? 'En cours' : 'À faire'}
                    </Etiquette>
                  )}
                </Link>
              );
            })}
            <Pagination
              page={seances.page}
              pages={seances.pages}
              total={seances.total}
              chemin="/presences"
            />
          </>
        )}
      </Carte>
    </div>
  );
}
