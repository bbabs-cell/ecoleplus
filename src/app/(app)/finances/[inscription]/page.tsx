import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { clientServeur } from '@/lib/supabase/server';
import {
  creancesDeLInscription,
  deviseEtablissement,
  paiementsDeLInscription,
  situationFinanciere,
} from '@/services/finances';
import { formaterMontant } from '@/lib/argent';
import { formaterDate, jourCourantIso, nomAffiche } from '@/lib/format';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { Alerte } from '@/components/ui/alerte';
import { Etiquette } from '@/components/ui/etiquette';
import { AjusterCreance, Caisse, LienRecu } from './caisse';

export const metadata: Metadata = { title: 'Dossier financier' };

const STATUTS: Record<string, { libelle: string; ton: 'neutre' | 'primaire' | 'succes' | 'alerte' | 'danger' }> = {
  UNPAID: { libelle: 'Impayée', ton: 'alerte' },
  PARTIAL: { libelle: 'Partielle', ton: 'primaire' },
  PAID: { libelle: 'Soldée', ton: 'succes' },
  CANCELLED: { libelle: 'Annulée', ton: 'neutre' },
};

export default async function PageDossierFinancier({
  params,
}: {
  params: Promise<{ inscription: string }>;
}) {
  const contexte = await exigerEtablissement('finance.read');
  const { inscription: inscriptionId } = await params;

  const supabase = await clientServeur();
  // RLS filtre déjà : une inscription hors périmètre remonte vide, donc en 404.
  const { data: inscription } = await supabase
    .from('enrollments')
    .select(
      'id, establishment_id, apprenant:learners(id, given_name, family_name, learner_code),' +
        ' classe:classes(id, name), annee:academic_years(id, name)',
    )
    .eq('id', inscriptionId)
    .maybeSingle();

  if (!inscription) notFound();

  type Ligne = {
    id: string;
    establishment_id: string;
    apprenant: { id: string; given_name: string; family_name: string; learner_code: string | null };
    classe: { id: string; name: string } | null;
    annee: { id: string; name: string } | null;
  };
  const dossier = inscription as unknown as Ligne;

  const [creances, paiements, situations, devise] = await Promise.all([
    creancesDeLInscription(inscriptionId),
    paiementsDeLInscription(inscriptionId),
    situationFinanciere(inscriptionId),
    deviseEtablissement(dossier.establishment_id, contexte.reglages.currency),
  ]);

  const format = contexte.reglages.name_display_format;
  const peutEncaisser = contexte.permissions.has('finance.collect');
  const peutAjuster = contexte.permissions.has('finance.assign');
  const peutAnnuler = contexte.permissions.has('finance.void');

  // Une seule devise dans l'immense majorité des cas ; plusieurs est un signal,
  // pas quelque chose à additionner.
  const principale = situations[0];
  const solde = principale?.solde ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/finances"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-encre-douce hover:text-encre"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Finances
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-encre">
          {nomAffiche(dossier.apprenant, format)}
        </h1>
        <p className="text-sm text-encre-douce">
          {[dossier.classe?.name, dossier.annee?.name, dossier.apprenant.learner_code]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      {situations.length > 1 ? (
        <Alerte ton="alerte" titre="Plusieurs devises sur ce dossier">
          Les montants ne s&apos;additionnent pas entre devises, et rien n&apos;est converti
          automatiquement. Chaque devise est présentée séparément.
        </Alerte>
      ) : null}

      {situations.length === 0 ? (
        <Carte>
          <CorpsCarte>
            <p className="text-sm text-encre-douce">
              Aucune créance. Affectez un frais depuis{' '}
              <Link href="/finances" className="font-medium text-primaire">
                la page Finances
              </Link>
              .
            </p>
          </CorpsCarte>
        </Carte>
      ) : (
        situations.map((situation) => (
          <Carte key={situation.devise}>
            <CorpsCarte className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-encre-douce">Total dû</p>
                <p className="text-lg font-semibold tabular-nums text-encre">
                  {formaterMontant(situation.du, situation.devise)}
                </p>
              </div>
              <div>
                <p className="text-xs text-encre-douce">Réglé</p>
                <p className="text-lg font-semibold tabular-nums text-succes">
                  {formaterMontant(situation.regle, situation.devise)}
                </p>
              </div>
              <div>
                <p className="text-xs text-encre-douce">Solde</p>
                <p
                  className={
                    situation.solde > 0
                      ? 'text-lg font-semibold tabular-nums text-danger'
                      : 'text-lg font-semibold tabular-nums text-succes'
                  }
                >
                  {formaterMontant(situation.solde, situation.devise)}
                </p>
              </div>
              <div>
                <p className="text-xs text-encre-douce">Échéances</p>
                <p className="text-lg font-semibold tabular-nums text-encre">
                  {situation.creances}
                  {situation.enRetard > 0 ? (
                    <span className="ms-1.5 inline-flex items-center gap-1 text-xs font-normal text-alerte">
                      <TriangleAlert className="size-3" aria-hidden="true" />
                      {situation.enRetard} en retard
                    </span>
                  ) : null}
                </p>
              </div>
            </CorpsCarte>
          </Carte>
        ))
      )}

      {peutEncaisser && creances.length > 0 ? (
        <Caisse
          inscriptionId={inscriptionId}
          creances={creances}
          devise={principale?.devise ?? devise}
          solde={solde}
          dateDuJour={jourCourantIso(contexte.reglages.timezone)}
          peutRepartir
        />
      ) : null}

      <Carte className="overflow-hidden">
        <EnTeteCarte>
          <TitreCarte>Créances</TitreCarte>
          <SousTitreCarte>
            Le solde de chaque ligne se déduit des paiements ; il ne se saisit pas.
          </SousTitreCarte>
        </EnTeteCarte>
        <CorpsCarte className="p-0">
          {creances.length === 0 ? (
            <p className="p-5 text-sm text-encre-douce">Aucune créance.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bordure text-start text-xs uppercase tracking-wide text-encre-douce">
                    <th scope="col" className="px-5 py-3 font-medium">Libellé</th>
                    <th scope="col" className="px-3 py-3 font-medium">Échéance</th>
                    <th scope="col" className="px-3 py-3 text-end font-medium">Dû</th>
                    <th scope="col" className="px-3 py-3 text-end font-medium">Réglé</th>
                    <th scope="col" className="px-5 py-3 text-end font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {creances.map((creance) => {
                    const statut = STATUTS[creance.status ?? 'UNPAID'] ?? STATUTS['UNPAID']!;
                    const enRetard =
                      creance.cancelled_at === null &&
                      (creance.total_minor ?? 0) > creance.paid_minor &&
                      creance.due_on < jourCourantIso(contexte.reglages.timezone);

                    return (
                      <tr key={creance.id} className="border-b border-bordure last:border-b-0">
                        <th scope="row" className="px-5 py-3 text-start font-medium text-encre">
                          {creance.label}
                          {creance.discount_minor > 0 ? (
                            <span className="ms-2 text-xs font-normal text-encre-douce">
                              remise {formaterMontant(creance.discount_minor, creance.currency)}
                            </span>
                          ) : null}
                          {creance.cancel_reason ? (
                            <span className="block text-xs font-normal text-encre-douce">
                              {creance.cancel_reason}
                            </span>
                          ) : null}
                        </th>
                        <td className="px-3 py-3 text-encre-douce">
                          {formaterDate(`${creance.due_on}T12:00:00Z`, contexte.reglages)}
                          {enRetard ? (
                            <span className="ms-1.5 text-xs font-medium text-alerte">en retard</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-end tabular-nums text-encre">
                          {formaterMontant(creance.total_minor, creance.currency)}
                        </td>
                        <td className="px-3 py-3 text-end tabular-nums text-encre-douce">
                          {formaterMontant(creance.paid_minor, creance.currency)}
                        </td>
                        <td className="px-5 py-3 text-end">
                          <Etiquette ton={statut.ton}>{statut.libelle}</Etiquette>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CorpsCarte>
      </Carte>

      {peutAjuster && creances.length > 0 ? (
        <AjusterCreance
          inscriptionId={inscriptionId}
          creances={creances}
          devise={principale?.devise ?? devise}
          peutAnnuler={peutAnnuler}
        />
      ) : null}

      <Carte className="overflow-hidden">
        <EnTeteCarte>
          <TitreCarte>Encaissements</TitreCarte>
          <SousTitreCarte>
            Un reçu annulé reste dans la liste : il ne se supprime jamais.
          </SousTitreCarte>
        </EnTeteCarte>
        <CorpsCarte className="p-0">
          {paiements.length === 0 ? (
            <p className="p-5 text-sm text-encre-douce">Aucun encaissement.</p>
          ) : (
            paiements.map((paiement) => (
              <div
                key={paiement.id}
                className="flex flex-wrap items-center gap-3 border-b border-bordure px-5 py-3 text-sm last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-encre">
                    {formaterMontant(paiement.amount_minor, paiement.currency)}
                    <span className="ms-2 font-normal text-encre-douce">
                      {paiement.method_label}
                    </span>
                  </p>
                  <p className="text-xs text-encre-douce">
                    {[
                      formaterDate(`${paiement.paid_on}T12:00:00Z`, contexte.reglages),
                      paiement.reference,
                      paiement.recu?.void_reason ? `annulé : ${paiement.recu.void_reason}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {paiement.recu ? (
                  <LienRecu
                    recuId={paiement.recu.id}
                    numero={paiement.recu.number}
                    annule={paiement.recu.voided_at !== null}
                  />
                ) : null}
              </div>
            ))
          )}
        </CorpsCarte>
      </Carte>
    </div>
  );
}
