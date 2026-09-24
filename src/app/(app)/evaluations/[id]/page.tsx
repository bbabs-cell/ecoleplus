import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { anomaliesDuBareme, feuilleDeNotes } from '@/services/notation';
import { formaterDate, nomAffiche } from '@/lib/format';
import { Alerte } from '@/components/ui/alerte';
import { Etiquette } from '@/components/ui/etiquette';
import { ActionsEvaluation, CorrectionNote, FeuilleDeNotes } from './feuille';

export const metadata: Metadata = { title: 'Saisie des notes' };

const POLITIQUES: Record<string, string> = {
  SKIP: 'Une note manquante est ignorée : la moyenne porte sur les notes présentes.',
  ZERO: 'Une note manquante compte comme zéro — choix explicite de cette évaluation.',
  EXCLUDED: "L'évaluation ne concerne pas les apprenants sans note.",
};

export default async function PageEvaluation({ params }: { params: Promise<{ id: string }> }) {
  const contexte = await exigerEtablissement('grades.read');
  const { id } = await params;

  // RLS filtre déjà : une évaluation hors périmètre remonte vide, donc en 404,
  // sans révéler qu'elle existe.
  const feuille = await feuilleDeNotes(id);
  if (!feuille) notFound();

  const { evaluation } = feuille;
  const publiee = evaluation.status === 'PUBLISHED';
  const figee = publiee || evaluation.status === 'CANCELLED';
  const format = contexte.reglages.name_display_format;

  const peutSaisir = contexte.permissions.has('grades.enter');
  const peutVerifier = contexte.permissions.has('grades.verify');
  const peutPublier = contexte.permissions.has('grades.publish');
  const peutCorriger = contexte.permissions.has('grades.correct');

  const anomalies = await anomaliesDuBareme(evaluation.grading_system_id);
  const erreurs = anomalies.filter((a) => a.gravite === 'ERREUR');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/evaluations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-encre-douce hover:text-encre"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Évaluations
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-encre">{evaluation.title}</h1>
          <p className="text-sm text-encre-douce">
            {[
              evaluation.classe?.name,
              evaluation.matiere?.name,
              formaterDate(`${evaluation.date_on}T12:00:00Z`, contexte.reglages),
              evaluation.bareme
                ? `${evaluation.bareme.name} (${evaluation.bareme.min_value}–${evaluation.bareme.max_value})`
                : null,
              `coefficient ${evaluation.coefficient}`,
              evaluation.categorie
                ? `${evaluation.categorie.name}, poids ${evaluation.categorie.weight}`
                : null,
              evaluation.enseignant ? nomAffiche(evaluation.enseignant, format) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {publiee ? (
          <Etiquette ton="succes">
            <Lock className="me-1 size-3" aria-hidden="true" />
            Publiée
          </Etiquette>
        ) : (
          <Etiquette ton={evaluation.status === 'VERIFIED' ? 'alerte' : 'primaire'}>
            {evaluation.status === 'VERIFIED' ? 'Vérifiée' : 'Ouverte'}
          </Etiquette>
        )}
      </header>

      <Alerte ton="info" titre="Traitement des notes manquantes">
        {POLITIQUES[evaluation.missing_grade_policy]}
      </Alerte>

      {erreurs.length > 0 ? (
        <Alerte ton="danger" titre="Ce barème porte des erreurs de configuration">
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {erreurs.map((anomalie) => (
              <li key={anomalie.code + anomalie.message}>{anomalie.message}</li>
            ))}
          </ul>
          <p className="mt-2">La publication sera refusée tant qu&apos;elles subsistent.</p>
        </Alerte>
      ) : null}

      {publiee ? (
        <Alerte ton="info" titre="Notes publiées">
          Une note publiée ne se modifie plus directement. Toute correction passe par un motif et
          reste inscrite à l&apos;historique.
        </Alerte>
      ) : null}

      {!peutSaisir && !figee ? (
        <Alerte ton="alerte">Vous consultez cette feuille sans pouvoir la modifier.</Alerte>
      ) : null}

      <FeuilleDeNotes
        evaluationId={evaluation.id}
        lignes={feuille.lignes}
        tranches={feuille.tranches}
        minimum={evaluation.bareme?.min_value ?? 0}
        maximum={evaluation.bareme?.max_value ?? 20}
        decimales={evaluation.bareme?.decimals ?? 2}
        format={format}
        figee={figee}
        peutSaisir={peutSaisir}
      />

      <ActionsEvaluation
        evaluationId={evaluation.id}
        statut={evaluation.status}
        peutVerifier={peutVerifier}
        peutPublier={peutPublier}
      />

      {peutCorriger ? (
        <CorrectionNote
          evaluationId={evaluation.id}
          lignes={feuille.lignes}
          format={format}
          minimum={evaluation.bareme?.min_value ?? 0}
          maximum={evaluation.bareme?.max_value ?? 20}
          decimales={evaluation.bareme?.decimals ?? 2}
        />
      ) : null}
    </div>
  );
}
