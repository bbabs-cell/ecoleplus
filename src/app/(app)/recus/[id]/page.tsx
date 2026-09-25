import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Ban } from 'lucide-react';
import { brand } from '@/config/brand';
import { exigerEtablissement } from '@/services/permissions';
import { affectationsDuRecu, recu } from '@/services/finances';
import { formaterMontant } from '@/lib/argent';
import { formaterDate, formaterDateHeure, nomAffiche } from '@/lib/format';
import { Carte, CorpsCarte } from '@/components/ui/carte';
import { Alerte } from '@/components/ui/alerte';
import { AnnulerRecu, ImprimerRecu } from './recu-client';
import { LienRetour } from '@/components/ui/lien-retour';

export const metadata: Metadata = { title: 'Reçu' };

export default async function PageRecu({ params }: { params: Promise<{ id: string }> }) {
  const contexte = await exigerEtablissement('finance.read');
  const { id } = await params;

  const fiche = await recu(id);
  if (!fiche) notFound();

  const paiement = fiche.paiement;
  const affectations = paiement ? await affectationsDuRecu(paiement.id) : [];
  const format = contexte.reglages.name_display_format;
  const annule = fiche.voided_at !== null;
  const peutAnnuler = contexte.permissions.has('finance.void');

  const apprenant = paiement?.inscription?.apprenant;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <LienRetour
          href={paiement?.inscription ? `/finances/${paiement.inscription.id}` : '/finances'}
        >
          Dossier financier
        </LienRetour>
        <ImprimerRecu />
      </div>

      {annule ? (
        <Alerte ton="danger" titre="Reçu annulé">
          {fiche.void_reason}
          {fiche.voided_at ? (
            <span className="block text-xs">
              Annulé le {formaterDateHeure(fiche.voided_at, contexte.reglages)}
            </span>
          ) : null}
        </Alerte>
      ) : null}

      <Carte className={annule ? 'opacity-70' : undefined}>
        <CorpsCarte className="space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-bordure pb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-encre-douce">
                {brand.name}
              </p>
              <h1 className="text-xl font-semibold text-encre">
                {contexte.etablissementActif.name}
              </h1>
            </div>
            <div className="text-end">
              <p className="text-xs uppercase tracking-wide text-encre-douce">Reçu n°</p>
              <p className="font-mono text-lg font-semibold text-encre">{fiche.number}</p>
              {annule ? (
                <p className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
                  <Ban className="size-3" aria-hidden="true" />
                  ANNULÉ
                </p>
              ) : null}
            </div>
          </header>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-encre-douce">Reçu de</dt>
              <dd className="font-medium text-encre">
                {apprenant ? nomAffiche(apprenant, format) : 'Apprenant inconnu'}
                {apprenant?.learner_code ? (
                  <span className="ms-2 font-mono text-xs text-encre-douce">
                    {apprenant.learner_code}
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-encre-douce">Classe</dt>
              <dd className="text-encre">{paiement?.inscription?.classe?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-encre-douce">Date du paiement</dt>
              <dd className="text-encre">
                {paiement
                  ? formaterDate(`${paiement.paid_on}T12:00:00Z`, contexte.reglages)
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-encre-douce">Moyen de paiement</dt>
              <dd className="text-encre">
                {paiement?.method_label ?? '—'}
                {paiement?.reference ? (
                  <span className="ms-2 font-mono text-xs text-encre-douce">
                    {paiement.reference}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>

          {affectations.length > 0 ? (
            <div className="space-y-1.5 border-t border-bordure pt-4">
              <p className="text-xs uppercase tracking-wide text-encre-douce">Règle</p>
              {affectations.map((affectation) => (
                <div
                  key={affectation.label + affectation.amount_minor}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                >
                  <span className="text-encre">{affectation.label}</span>
                  <span className="tabular-nums text-encre-douce">
                    {formaterMontant(affectation.amount_minor, paiement?.currency ?? 'EUR')}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-bordure pt-4">
            <span className="text-sm text-encre-douce">Montant reçu</span>
            <span className="text-2xl font-semibold tabular-nums text-encre">
              {formaterMontant(paiement?.amount_minor ?? null, paiement?.currency ?? 'EUR')}
            </span>
          </div>

          {paiement?.notes ? (
            <p className="text-sm text-encre-douce">{paiement.notes}</p>
          ) : null}

          <p className="border-t border-bordure pt-4 text-xs text-encre-douce">
            Émis le {formaterDateHeure(fiche.issued_at, contexte.reglages)}.
          </p>
        </CorpsCarte>
      </Carte>

      {peutAnnuler && !annule ? (
        <div className="print:hidden">
          <AnnulerRecu recuId={fiche.id} />
        </div>
      ) : null}
    </div>
  );
}
