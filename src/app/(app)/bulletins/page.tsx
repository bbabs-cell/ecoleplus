import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { listerPeriodes, resoudreAnnee } from '@/services/academique';
import { listerClasses } from '@/services/classes';
import { inscriptionsDeLaClasse, listerBulletins, rangActive } from '@/services/bulletins';
import { formaterDateHeure, nomAffiche } from '@/lib/format';
import { Carte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { Alerte } from '@/components/ui/alerte';
import { Etiquette } from '@/components/ui/etiquette';
import { SelecteurAnnee } from '@/components/academique/selecteur-annee';
import { SelecteursBulletin } from './selecteurs';
import { ReglageRang, VerifierClasse, VerifierUnBulletin } from './actions-client';
import { TitrePage } from '@/components/ui/titre-page';

export const metadata: Metadata = { title: 'Bulletins' };

const STATUTS: Record<string, { libelle: string; ton: 'neutre' | 'alerte' | 'succes' }> = {
  DRAFT: { libelle: 'Brouillon', ton: 'neutre' },
  VERIFIED: { libelle: 'Vérifié', ton: 'alerte' },
  PUBLISHED: { libelle: 'Publié', ton: 'succes' },
};

export default async function PageBulletins({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; classe?: string; periode?: string }>;
}) {
  const contexte = await exigerEtablissement('reports.read');
  const { annee: anneeDemandee, classe: classeId, periode: periodeId } = await searchParams;

  const { annee, annees } = await resoudreAnnee(contexte.etablissementActif.id, anneeDemandee);
  const format = contexte.reglages.name_display_format;
  const peutVerifier = contexte.permissions.has('reports.verify');
  const peutRegler = contexte.permissions.has('establishments.update');

  if (!annee) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <TitrePage teinte="notation">Bulletins</TitrePage>
        <Alerte ton="alerte" titre="Aucune année académique">
          Un bulletin se rattache à une année.{' '}
          <Link href="/annees" className="font-medium text-primaire">
            Créez-en une d&apos;abord
          </Link>
          .
        </Alerte>
      </div>
    );
  }

  const [classes, periodes, rang] = await Promise.all([
    listerClasses(annee.id),
    listerPeriodes(annee.id),
    rangActive(contexte.etablissementActif.id),
  ]);

  const [bulletins, inscriptions] = classeId
    ? await Promise.all([
        listerBulletins(classeId, periodeId ?? null),
        inscriptionsDeLaClasse(classeId),
      ])
    : [[], []];

  const parInscription = new Map(bulletins.map((b) => [b.enrollment_id, b]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <TitrePage teinte="notation">Bulletins</TitrePage>
          <p className="text-sm text-encre-douce">
            {contexte.etablissementActif.name} · {annee.name}
          </p>
        </div>
        <SelecteurAnnee annees={annees} anneeActive={annee.id} />
      </header>

      {peutRegler ? <ReglageRang actif={rang} /> : null}

      <Suspense fallback={null}>
        <SelecteursBulletin
          classes={classes.filter((classe) => classe.is_active)}
          periodes={periodes}
          classeActive={classeId ?? ''}
          periodeActive={periodeId ?? ''}
        />
      </Suspense>

      {!classeId ? (
        <Carte>
          <EtatVide
            icone={<FileText className="size-8" />}
            titre="Choisissez une classe"
            description="Les bulletins se préparent classe par classe, sur une période ou sur l'année entière."
          />
        </Carte>
      ) : inscriptions.length === 0 ? (
        <Carte>
          <EtatVide
            icone={<FileText className="size-8" />}
            titre="Aucun apprenant"
            description="Cette classe ne compte aucune inscription vivante."
          />
        </Carte>
      ) : (
        <>
          {peutVerifier ? (
            <VerifierClasse
              classeId={classeId}
              periodeId={periodeId ?? ''}
              effectif={inscriptions.length}
            />
          ) : null}

          <Carte className="overflow-hidden">
            {inscriptions.map((inscription) => {
              const bulletin = parInscription.get(inscription.id);
              const statut = bulletin ? (STATUTS[bulletin.status] ?? STATUTS['DRAFT']!) : null;

              return (
                <div
                  key={inscription.id}
                  className="flex flex-wrap items-center gap-3 border-b border-bordure p-5 last:border-b-0"
                >
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
                      {bulletin ? (
                        <>
                          {bulletin.general_value === null
                            ? 'Aucune moyenne calculable'
                            : `Moyenne ${bulletin.general_value}`}
                          {bulletin.rank !== null
                            ? ` · rang ${bulletin.rank} sur ${bulletin.rank_of}`
                            : ''}
                          {' · établi le '}
                          {formaterDateHeure(bulletin.generated_at, contexte.reglages)}
                        </>
                      ) : (
                        'Pas encore établi'
                      )}
                    </p>
                  </div>

                  {statut ? <Etiquette ton={statut.ton}>{statut.libelle}</Etiquette> : null}

                  {bulletin ? (
                    <Link
                      href={`/bulletins/${bulletin.id}`}
                      className="inline-flex h-8 items-center rounded-douce border border-bordure px-3 text-xs font-medium hover:bg-surface-2"
                    >
                      Ouvrir
                    </Link>
                  ) : peutVerifier ? (
                    <VerifierUnBulletin
                      inscriptionId={inscription.id}
                      periodeId={periodeId ?? ''}
                    />
                  ) : null}
                </div>
              );
            })}
          </Carte>
        </>
      )}
    </div>
  );
}
