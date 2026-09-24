import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, History, Lock } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { bulletin, lireInstantane, versionsPubliees } from '@/services/bulletins';
import { formaterDateHeure, nomAffiche } from '@/lib/format';
import { Alerte } from '@/components/ui/alerte';
import { Etiquette } from '@/components/ui/etiquette';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { PublierBulletin } from '../actions-client';

export const metadata: Metadata = { title: 'Bulletin' };

export default async function PageBulletin({ params }: { params: Promise<{ id: string }> }) {
  const contexte = await exigerEtablissement('reports.read');
  const { id } = await params;

  const fiche = await bulletin(id);
  if (!fiche) notFound();

  const versions = await versionsPubliees(id);
  const instantane = lireInstantane(fiche.snapshot);
  const format = contexte.reglages.name_display_format;
  const peutPublier = contexte.permissions.has('reports.publish');

  const apprenant = fiche.inscription?.apprenant;
  const publie = fiche.status === 'PUBLISHED';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/bulletins"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-encre-douce hover:text-encre"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Bulletins
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-encre">
            {apprenant ? nomAffiche(apprenant, format) : 'Apprenant inconnu'}
          </h1>
          <p className="text-sm text-encre-douce">
            {[
              fiche.classe?.name,
              fiche.periode?.name ?? 'Année entière',
              instantane.annee?.name,
              `établi le ${formaterDateHeure(fiche.generated_at, contexte.reglages)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {publie ? (
          <Etiquette ton="succes">
            <Lock className="mr-1 size-3" aria-hidden="true" />
            Publié
          </Etiquette>
        ) : (
          <Etiquette ton="alerte">Vérifié, non publié</Etiquette>
        )}
      </header>

      {publie ? (
        <Alerte ton="info" titre="Instantané figé">
          Ce que vous lisez est l&apos;instantané enregistré à la vérification, pas un recalcul.
          Une note corrigée depuis ne le modifie pas : republier créerait une nouvelle version, à
          côté de celles déjà remises.
        </Alerte>
      ) : null}

      <Carte>
        <EnTeteCarte>
          <TitreCarte>Résultats par matière</TitreCarte>
          <SousTitreCarte>
            Les compteurs accompagnent chaque moyenne : une moyenne portant sur deux notes et une
            moyenne portant sur douze ne disent pas la même chose.
          </SousTitreCarte>
        </EnTeteCarte>
        <CorpsCarte className="p-0">
          {instantane.matieres.length === 0 ? (
            <p className="p-5 text-sm text-encre-douce">
              Aucune matière évaluée sur cette période.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bordure text-left text-xs uppercase tracking-wide text-encre-douce">
                    <th scope="col" className="px-5 py-3 font-medium">
                      Matière
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      Coef.
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      Moyenne
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Appréciation
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {instantane.matieres.map((matiere) => (
                    <tr key={matiere.subject_id} className="border-b border-bordure last:border-b-0">
                      <th scope="row" className="px-5 py-3 text-left font-medium text-encre">
                        {matiere.nom}
                      </th>
                      <td className="px-3 py-3 text-right tabular-nums text-encre-douce">
                        {matiere.coefficient ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {matiere.valeur === null ? (
                          <span className="text-encre-douce">Non calculable</span>
                        ) : (
                          <span className="font-semibold tabular-nums text-encre">
                            {matiere.valeur}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-encre-douce">{matiere.mention ?? '—'}</td>
                      <td className="px-5 py-3 text-right text-xs text-encre-douce">
                        {matiere.notes_prises ?? 0} prise
                        {(matiere.notes_prises ?? 0) > 1 ? 's' : ''}
                        {(matiere.notes_ignorees ?? 0) > 0
                          ? ` · ${matiere.notes_ignorees} ignorée${(matiere.notes_ignorees ?? 0) > 1 ? 's' : ''}`
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CorpsCarte>
      </Carte>

      <Carte>
        <CorpsCarte className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-sm text-encre-douce">Moyenne générale</p>
            <p className="text-3xl font-semibold tabular-nums text-encre">
              {instantane.moyenne_generale?.valeur ?? '—'}
            </p>
            {instantane.moyenne_generale?.mention ? (
              <p className="text-sm text-encre-douce">{instantane.moyenne_generale.mention}</p>
            ) : null}
          </div>

          {/* Le rang n'apparaît que si l'établissement l'a demandé. */}
          {fiche.rank !== null ? (
            <div className="text-right">
              <p className="text-sm text-encre-douce">Rang</p>
              <p className="text-3xl font-semibold tabular-nums text-encre">
                {fiche.rank}
                <span className="text-base font-normal text-encre-douce"> / {fiche.rank_of}</span>
              </p>
            </div>
          ) : null}
        </CorpsCarte>
      </Carte>

      {peutPublier ? <PublierBulletin bulletinId={fiche.id} dejaPublie={versions.length > 0} /> : null}

      {versions.length > 0 ? (
        <Carte>
          <EnTeteCarte>
            <TitreCarte className="flex items-center gap-2">
              <History className="size-4" aria-hidden="true" />
              Versions remises
            </TitreCarte>
            <SousTitreCarte>
              Chaque publication est conservée telle qu&apos;elle a été remise. Aucune ne
              s&apos;écrase.
            </SousTitreCarte>
          </EnTeteCarte>
          <CorpsCarte className="p-0">
            {versions.map((version) => {
              const contenu = lireInstantane(version.snapshot);
              return (
                <div
                  key={version.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-bordure px-5 py-3 text-sm last:border-b-0"
                >
                  <span className="font-medium text-encre">Version {version.version}</span>
                  <span className="text-encre-douce">
                    Moyenne {contenu.moyenne_generale?.valeur ?? '—'} ·{' '}
                    {formaterDateHeure(version.published_at, contexte.reglages)}
                  </span>
                  {version.reason ? (
                    <span className="w-full text-xs text-encre-douce">
                      Motif : {version.reason}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </CorpsCarte>
        </Carte>
      ) : null}
    </div>
  );
}
