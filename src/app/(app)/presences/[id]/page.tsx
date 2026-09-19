import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { feuilleDAppel, statutsUtilisables } from '@/services/presences';
import { formaterDate, formaterHeure, nomAffiche } from '@/lib/format';
import { Alerte } from '@/components/ui/alerte';
import { Etiquette } from '@/components/ui/etiquette';
import { ActionsSeance, CorrectionPresence, FeuilleDAppel } from './feuille';

export const metadata: Metadata = { title: "Feuille d'appel" };

export default async function PageSeance({ params }: { params: Promise<{ id: string }> }) {
  const contexte = await exigerEtablissement('attendance.read');
  const { id } = await params;

  // RLS filtre déjà la séance : une séance d'un autre établissement remonte
  // vide, donc en 404, sans révéler qu'elle existe.
  const feuille = await feuilleDAppel(id);
  if (!feuille) notFound();

  const statuts = await statutsUtilisables(feuille.seance.establishment_id);
  const close = feuille.seance.status === 'VALIDATED';
  const format = contexte.reglages.name_display_format;

  const peutSaisir = contexte.permissions.has('attendance.record');
  const peutValider = contexte.permissions.has('attendance.validate');
  const peutCorriger = contexte.permissions.has('attendance.correct');

  const horaire = [formaterHeure(feuille.seance.starts_at), formaterHeure(feuille.seance.ends_at)]
    .filter(Boolean)
    .join(' – ');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/presences"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-encre-douce hover:text-encre"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Séances
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-encre">
            {feuille.seance.classe?.name ?? 'Classe supprimée'}
          </h1>
          <p className="text-sm text-encre-douce">
            {[
              formaterDate(`${feuille.seance.date_on}T12:00:00Z`, contexte.reglages),
              horaire,
              feuille.seance.matiere?.name,
              feuille.seance.enseignant
                ? nomAffiche(feuille.seance.enseignant, format)
                : null,
              feuille.seance.kind_label,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {close ? (
          <Etiquette ton="succes">
            <Lock className="mr-1 size-3" aria-hidden="true" />
            Validée
          </Etiquette>
        ) : (
          <Etiquette ton="primaire">Ouverte</Etiquette>
        )}
      </header>

      {statuts.length === 0 ? (
        <Alerte ton="danger" titre="Aucun statut de présence">
          Aucun statut n&apos;est défini pour cet établissement : l&apos;appel est impossible tant
          que l&apos;organisation n&apos;en a pas configuré.
        </Alerte>
      ) : (
        <>
          {close ? (
            <Alerte ton="info" titre="Feuille close">
              Une feuille validée ne se modifie plus directement. Toute correction passe par un
              motif et reste inscrite à l&apos;historique.
            </Alerte>
          ) : null}

          {!peutSaisir && !close ? (
            <Alerte ton="alerte">
              Vous consultez cette feuille sans pouvoir la modifier.
            </Alerte>
          ) : null}

          <FeuilleDAppel
            seanceId={feuille.seance.id}
            lignes={feuille.lignes}
            statuts={statuts}
            format={format}
            close={close}
            peutSaisir={peutSaisir}
          />

          <ActionsSeance
            seanceId={feuille.seance.id}
            close={close}
            peutValider={peutValider}
            peutCorriger={peutCorriger}
          />

          {close && peutCorriger ? (
            <CorrectionPresence
              seanceId={feuille.seance.id}
              lignes={feuille.lignes}
              statuts={statuts}
              format={format}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
