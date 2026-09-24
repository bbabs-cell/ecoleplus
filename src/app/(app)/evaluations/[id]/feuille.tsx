'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { BadgeCheck, Ban, PenLine, Send } from 'lucide-react';
import {
  annulerNoteAction,
  corrigerNoteAction,
  publierEvaluationAction,
  saisirNotesAction,
  verifierEvaluationAction,
} from '@/services/notation.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { GradeKind, GradingScale, NameDisplayFormat } from '@/lib/types/database';
import type { LigneNote } from '@/services/notation';
import { nomAffiche } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Bouton } from '@/components/ui/bouton';
import { Alerte } from '@/components/ui/alerte';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { EtatNote, NATURES_SAISISSABLES, libelleNature } from '@/components/notation/nature-note';

function BoutonEnvoi({ libelle, enCours }: { libelle: string; enCours: string }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? enCours : libelle}
    </Bouton>
  );
}

/**
 * Feuille de notes.
 *
 * Chaque ligne porte DEUX champs : la nature de la note et, seulement si cette
 * nature est « Note », une valeur. Laisser la valeur vide ne produit pas un
 * zéro — c'est le point de tout le module. Une ligne restée « Non saisie »
 * bloquera la vérification, ce qui est le comportement voulu : une case vide
 * n'est ni une note ni une absence, et cette ambiguïté ne doit pas être figée.
 */
export function FeuilleDeNotes({
  evaluationId,
  lignes,
  tranches,
  minimum,
  maximum,
  decimales,
  format,
  figee,
  peutSaisir,
}: {
  evaluationId: string;
  lignes: LigneNote[];
  tranches: GradingScale[];
  minimum: number;
  maximum: number;
  decimales: number;
  format: NameDisplayFormat;
  figee: boolean;
  peutSaisir: boolean;
}) {
  const [etat, action] = useActionState(saisirNotesAction, ETAT_INITIAL);
  const [natures, setNatures] = useState<Record<string, GradeKind>>(() =>
    Object.fromEntries(lignes.map((l) => [l.enrollmentId, l.nature])),
  );

  const nonSaisies = lignes.filter((l) => (natures[l.enrollmentId] ?? 'PENDING') === 'PENDING').length;
  const pasAPas = 1 / 10 ** decimales;

  if (lignes.length === 0) {
    return (
      <Alerte ton="alerte" titre="Aucun apprenant dans cette classe">
        Inscrivez des apprenants avant de saisir des notes.
      </Alerte>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="evaluationId" value={evaluationId} />

      {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}
      {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}

      {peutSaisir && !figee ? (
        <div className="rounded-douce border border-bordure bg-carte px-4 py-3 text-sm text-encre-douce">
          {nonSaisies === 0 ? (
            <span className="font-medium text-succes">Toutes les lignes ont une nature</span>
          ) : (
            <>
              <span className="font-semibold tabular-nums text-encre">{nonSaisies}</span> ligne
              {nonSaisies > 1 ? 's' : ''} non saisie{nonSaisies > 1 ? 's' : ''} — ni note, ni
              absence. La vérification les refusera.
            </>
          )}
        </div>
      ) : null}

      <ul className="space-y-2">
        {lignes.map((ligne) => {
          const nom = nomAffiche(ligne.apprenant, format);
          const nature = natures[ligne.enrollmentId] ?? 'PENDING';
          const chiffree = nature === 'SCORE';
          const verrouillee =
            figee ||
            !peutSaisir ||
            (ligne.statut !== null &&
              ['PUBLISHED', 'CORRECTED', 'CANCELLED', 'ARCHIVED'].includes(ligne.statut));

          return (
            <li
              key={ligne.enrollmentId}
              className="rounded-douce border border-bordure bg-carte p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-encre">{nom || 'Sans nom'}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {ligne.apprenant.learner_code ? (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-encre-douce">
                      {ligne.apprenant.learner_code}
                    </span>
                  ) : null}
                  {ligne.statut ? <EtatNote etat={ligne.statut} /> : null}
                  {ligne.corrections > 0 ? (
                    <span className="text-xs text-encre-douce">
                      {ligne.corrections} correction{ligne.corrections > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>
              </div>

              <fieldset className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]" disabled={verrouillee}>
                <legend className="sr-only">Note de {nom}</legend>

                <Liste
                  name={`nature:${ligne.enrollmentId}`}
                  value={nature}
                  aria-label={`Nature de la note de ${nom}`}
                  onChange={(evenement) =>
                    setNatures((precedent) => ({
                      ...precedent,
                      [ligne.enrollmentId]: evenement.target.value as GradeKind,
                    }))
                  }
                  className="min-h-11"
                >
                  {NATURES_SAISISSABLES.map((valeur) => (
                    <option key={valeur} value={valeur}>
                      {libelleNature(valeur)}
                    </option>
                  ))}
                </Liste>

                <Saisie
                  name={`valeur:${ligne.enrollmentId}`}
                  type="number"
                  inputMode="decimal"
                  step={pasAPas}
                  min={minimum}
                  max={maximum}
                  defaultValue={ligne.valeur ?? ''}
                  aria-label={`Valeur de la note de ${nom}`}
                  placeholder={`${minimum}–${maximum}`}
                  // Le champ disparaît dès que la nature n'est plus « Note » :
                  // une absence ne peut pas porter de valeur, ici comme en base.
                  className={cn('min-h-11 sm:w-32', !chiffree && 'invisible')}
                  disabled={verrouillee || !chiffree}
                />
              </fieldset>

              {tranches.length > 0 && chiffree ? (
                <p className="mt-1.5 text-xs text-encre-douce">
                  {tranches.map((t) => `${t.label} ${t.min_score}–${t.max_score}`).join(' · ')}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {peutSaisir && !figee ? (
        <div className="sticky bottom-4 flex justify-end">
          <BoutonEnvoi libelle="Enregistrer la saisie" enCours="Enregistrement…" />
        </div>
      ) : null}
    </form>
  );
}

export function ActionsEvaluation({
  evaluationId,
  statut,
  peutVerifier,
  peutPublier,
}: {
  evaluationId: string;
  statut: string;
  peutVerifier: boolean;
  peutPublier: boolean;
}) {
  const [etatVerif, actionVerif] = useActionState(verifierEvaluationAction, ETAT_INITIAL);
  const [etatPub, actionPub] = useActionState(publierEvaluationAction, ETAT_INITIAL);

  const erreur =
    etatVerif.statut === 'erreur'
      ? etatVerif.message
      : etatPub.statut === 'erreur'
        ? etatPub.message
        : null;
  const succes =
    etatVerif.statut === 'succes'
      ? etatVerif.message
      : etatPub.statut === 'succes'
        ? etatPub.message
        : null;

  return (
    <div className="space-y-2">
      {erreur ? <Alerte ton="danger">{erreur}</Alerte> : null}
      {succes ? <Alerte ton="succes">{succes}</Alerte> : null}

      <div className="flex flex-wrap gap-2">
        {statut !== 'PUBLISHED' && peutVerifier ? (
          <form action={actionVerif}>
            <input type="hidden" name="evaluationId" value={evaluationId} />
            <Bouton variante="secondaire" type="submit">
              <BadgeCheck className="size-4" aria-hidden="true" />
              Vérifier la saisie
            </Bouton>
          </form>
        ) : null}

        {statut === 'VERIFIED' && peutPublier ? (
          <form action={actionPub}>
            <input type="hidden" name="evaluationId" value={evaluationId} />
            <Bouton type="submit">
              <Send className="size-4" aria-hidden="true" />
              Publier les notes
            </Bouton>
          </form>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Correction d'une note publiée.
 *
 * Seule voie de modification après publication : permission dédiée, motif
 * obligatoire, entrée d'historique. Invalider une note l'écarte des calculs
 * sans la faire disparaître — « invalidée » est un état, pas une suppression.
 */
export function CorrectionNote({
  evaluationId,
  lignes,
  format,
  minimum,
  maximum,
  decimales,
}: {
  evaluationId: string;
  lignes: LigneNote[];
  format: NameDisplayFormat;
  minimum: number;
  maximum: number;
  decimales: number;
}) {
  const [etatCorrection, actionCorrection] = useActionState(corrigerNoteAction, ETAT_INITIAL);
  const [etatAnnulation, actionAnnulation] = useActionState(annulerNoteAction, ETAT_INITIAL);
  const [ouvert, setOuvert] = useState(false);
  const [nature, setNature] = useState<GradeKind>('SCORE');

  const corrigeables = lignes.filter((ligne) => ligne.noteId);
  if (corrigeables.length === 0) return null;

  const succes =
    etatCorrection.statut === 'succes'
      ? etatCorrection.message
      : etatAnnulation.statut === 'succes'
        ? etatAnnulation.message
        : null;

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {succes ? <Alerte ton="succes">{succes}</Alerte> : null}
        <Bouton variante="secondaire" onClick={() => setOuvert(true)}>
          <PenLine className="size-4" aria-hidden="true" />
          Corriger ou invalider une note
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte>Corriger une note</TitreCarte>
        <SousTitreCarte>
          La correction s&apos;ajoute à l&apos;historique sans le réécrire. Le motif est conservé,
          dans l&apos;historique de la note et dans le journal d&apos;audit.
        </SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte className="space-y-6">
        <form action={actionCorrection} className="space-y-4" noValidate>
          <input type="hidden" name="evaluationId" value={evaluationId} />
          {etatCorrection.statut === 'erreur' ? (
            <Alerte ton="danger">{etatCorrection.message}</Alerte>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Champ label="Apprenant" htmlFor="noteId" obligatoire>
              <Liste id="noteId" name="noteId" required defaultValue="">
                <option value="" disabled>
                  Sélectionnez
                </option>
                {corrigeables.map((ligne) => (
                  <option key={ligne.noteId} value={ligne.noteId ?? ''}>
                    {nomAffiche(ligne.apprenant, format)}
                  </option>
                ))}
              </Liste>
            </Champ>

            <Champ label="Nature" htmlFor="nature" obligatoire>
              <Liste
                id="nature"
                name="nature"
                required
                value={nature}
                onChange={(evenement) => setNature(evenement.target.value as GradeKind)}
              >
                {NATURES_SAISISSABLES.filter((n) => n !== 'PENDING').map((valeur) => (
                  <option key={valeur} value={valeur}>
                    {libelleNature(valeur)}
                  </option>
                ))}
              </Liste>
            </Champ>

            <Champ label="Valeur" htmlFor="valeur">
              <Saisie
                id="valeur"
                name="valeur"
                type="number"
                step={1 / 10 ** decimales}
                min={minimum}
                max={maximum}
                disabled={nature !== 'SCORE'}
                placeholder={nature === 'SCORE' ? `${minimum}–${maximum}` : 'Sans objet'}
              />
            </Champ>
          </div>

          <Champ label="Motif" htmlFor="raison" obligatoire>
            <Saisie
              id="raison"
              name="raison"
              required
              placeholder="Erreur de report constatée sur la copie"
            />
          </Champ>

          <div className="flex gap-2">
            <BoutonEnvoi libelle="Enregistrer la correction" enCours="Enregistrement…" />
            <Bouton variante="secondaire" type="button" onClick={() => setOuvert(false)}>
              Fermer
            </Bouton>
          </div>
        </form>

        <div className="border-t border-bordure pt-6">
          <form action={actionAnnulation} className="space-y-4" noValidate>
            <input type="hidden" name="evaluationId" value={evaluationId} />
            {etatAnnulation.statut === 'erreur' ? (
              <Alerte ton="danger">{etatAnnulation.message}</Alerte>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ label="Invalider la note de" htmlFor="noteIdAnnulation" obligatoire>
                <Liste id="noteIdAnnulation" name="noteId" required defaultValue="">
                  <option value="" disabled>
                    Sélectionnez
                  </option>
                  {corrigeables.map((ligne) => (
                    <option key={ligne.noteId} value={ligne.noteId ?? ''}>
                      {nomAffiche(ligne.apprenant, format)}
                    </option>
                  ))}
                </Liste>
              </Champ>
              <Champ
                label="Motif"
                htmlFor="raisonAnnulation"
                aide="La note sort des calculs mais reste consultable."
                obligatoire
              >
                <Saisie
                  id="raisonAnnulation"
                  name="raison"
                  required
                  placeholder="Sujet erroné distribué"
                />
              </Champ>
            </div>

            <Bouton variante="danger" type="submit">
              <Ban className="size-4" aria-hidden="true" />
              Invalider la note
            </Bouton>
          </form>
        </div>
      </CorpsCarte>
    </Carte>
  );
}
