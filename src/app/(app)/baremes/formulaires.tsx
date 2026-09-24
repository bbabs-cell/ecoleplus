'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Plus, Star, Trash2, X } from 'lucide-react';
import {
  ajouterTrancheAction,
  creerBaremeAction,
  creerCategorieAction,
  definirBaremeClasseAction,
  definirBaremeParDefautAction,
  definirCoefficientAction,
  supprimerTrancheAction,
} from '@/services/notation.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { Classe, GradingScale, GradingSystem, Subject } from '@/lib/types/database';
import type { AnomalieBareme, CoefficientMatiere } from '@/services/notation';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';
import { Etiquette } from '@/components/ui/etiquette';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';

function BoutonEnvoi({ libelle, enCours }: { libelle: string; enCours: string }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? enCours : libelle}
    </Bouton>
  );
}

const TYPES: { valeur: string; libelle: string; aide: string }[] = [
  { valeur: 'NUMERIC', libelle: 'Numérique', aide: 'sur 10, sur 20, sur 100, échelle libre' },
  { valeur: 'LETTER', libelle: 'Lettres', aide: 'A, B, C… adossées à des tranches' },
  { valeur: 'MASTERY', libelle: 'Niveaux de maîtrise', aide: 'acquis, en cours, non acquis' },
  { valeur: 'CUSTOM', libelle: 'Sur mesure', aide: 'appréciations, barème maison' },
];

export function FormulaireBareme() {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(creerBaremeAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton onClick={() => setOuvert(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nouveau barème
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <TitreCarte>Nouveau barème</TitreCarte>
          <SousTitreCarte>
            Plusieurs barèmes coexistent dans un même établissement. Aucun n&apos;est la norme.
          </SousTitreCarte>
        </div>
        <Bouton variante="discret" taille="petite" onClick={() => setOuvert(false)}>
          <X className="size-4" aria-hidden="true" />
          Annuler
        </Bouton>
      </EnTeteCarte>
      <CorpsCarte>
        <form action={action} className="space-y-4" noValidate>
          {etat.statut === 'erreur' && !etat.champs ? (
            <Alerte ton="danger">{etat.message}</Alerte>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Nom" htmlFor="nom" erreur={champs['nom']} obligatoire>
              <Saisie id="nom" name="nom" required autoComplete="off" placeholder="Note sur 20" />
            </Champ>
            <Champ label="Code" htmlFor="code" erreur={champs['code']} obligatoire>
              <Saisie id="code" name="code" required autoComplete="off" placeholder="NUM20" />
            </Champ>

            <Champ label="Type" htmlFor="type" erreur={champs['type']} obligatoire>
              <Liste id="type" name="type" required defaultValue="NUMERIC">
                {TYPES.map((type) => (
                  <option key={type.valeur} value={type.valeur}>
                    {type.libelle} — {type.aide}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ label="Unité" htmlFor="unite" erreur={champs['unite']}>
              <Saisie id="unite" name="unite" autoComplete="off" placeholder="points" />
            </Champ>

            <Champ label="Minimum" htmlFor="minimum" erreur={champs['minimum']} obligatoire>
              <Saisie id="minimum" name="minimum" type="number" step="0.01" defaultValue="0" required />
            </Champ>
            <Champ label="Maximum" htmlFor="maximum" erreur={champs['maximum']} obligatoire>
              <Saisie
                id="maximum"
                name="maximum"
                type="number"
                step="0.01"
                defaultValue="20"
                required
                erreur={Boolean(champs['maximum'])}
              />
            </Champ>

            <Champ
              label="Seuil de réussite"
              htmlFor="seuilReussite"
              erreur={champs['seuilReussite']}
              aide="Facultatif. Doit tenir dans l'échelle."
            >
              <Saisie id="seuilReussite" name="seuilReussite" type="number" step="0.01" />
            </Champ>
            <Champ label="Arrondi" htmlFor="arrondi" erreur={champs['arrondi']} obligatoire>
              <Liste id="arrondi" name="arrondi" required defaultValue="ROUND">
                <option value="ROUND">Au plus proche</option>
                <option value="FLOOR">Vers le bas</option>
                <option value="CEIL">Vers le haut</option>
              </Liste>
            </Champ>

            <Champ label="Décimales" htmlFor="decimales" erreur={champs['decimales']} obligatoire>
              <Saisie
                id="decimales"
                name="decimales"
                type="number"
                min="0"
                max="4"
                defaultValue="2"
                required
              />
            </Champ>

            <label className="flex min-h-11 items-center gap-2 self-end text-sm text-encre">
              <input
                type="checkbox"
                name="moyennable"
                defaultChecked
                className="size-4 rounded border-bordure"
              />
              Entre dans le calcul des moyennes
            </label>
          </div>

          <p className="text-xs text-encre-douce">
            Moyenner des niveaux de maîtrise n&apos;a pas toujours de sens. Décochez la case si ce
            barème doit s&apos;afficher sans être moyenné.
          </p>

          <BoutonEnvoi libelle="Créer le barème" enCours="Création…" />
        </form>
      </CorpsCarte>
    </Carte>
  );
}

export function CarteBareme({
  bareme,
  tranches,
  anomalies,
  peutModifier,
}: {
  bareme: GradingSystem;
  tranches: GradingScale[];
  anomalies: AnomalieBareme[];
  peutModifier: boolean;
}) {
  const [etatAjout, actionAjout] = useActionState(ajouterTrancheAction, ETAT_INITIAL);
  const [etatRetrait, actionRetrait] = useActionState(supprimerTrancheAction, ETAT_INITIAL);
  const [etatDefaut, actionDefaut] = useActionState(definirBaremeParDefautAction, ETAT_INITIAL);
  const [ouvert, setOuvert] = useState(false);

  const erreurs = anomalies.filter((a) => a.gravite === 'ERREUR');
  const avertissements = anomalies.filter((a) => a.gravite === 'AVERTISSEMENT');

  return (
    <Carte>
      <EnTeteCarte className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <TitreCarte className="flex flex-wrap items-center gap-2">
            {bareme.name}
            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-encre-douce">
              {bareme.code}
            </span>
            {!bareme.allows_averaging ? <Etiquette>Non moyenné</Etiquette> : null}
            {bareme.is_default ? <Etiquette ton="primaire">Par défaut</Etiquette> : null}
          </TitreCarte>
          <SousTitreCarte>
            {bareme.min_value}–{bareme.max_value}
            {bareme.unit ? ` ${bareme.unit}` : ''} · arrondi{' '}
            {bareme.rounding_mode === 'ROUND'
              ? 'au plus proche'
              : bareme.rounding_mode === 'FLOOR'
                ? 'vers le bas'
                : 'vers le haut'}{' '}
            à {bareme.decimals} décimale{bareme.decimals > 1 ? 's' : ''}
            {bareme.pass_threshold !== null ? ` · réussite à ${bareme.pass_threshold}` : ''}
            {bareme.establishment_id === null ? ' · organisation' : ' · établissement'}
          </SousTitreCarte>
        </div>
        {erreurs.length > 0 ? (
          <Etiquette ton="danger">
            {erreurs.length} erreur{erreurs.length > 1 ? 's' : ''}
          </Etiquette>
        ) : (
          <Etiquette ton="succes">Cohérent</Etiquette>
        )}
      </EnTeteCarte>

      <CorpsCarte className="space-y-4">
        {erreurs.length > 0 ? (
          <Alerte ton="danger" titre="Configuration à corriger avant publication">
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {erreurs.map((anomalie) => (
                <li key={anomalie.code + anomalie.message}>{anomalie.message}</li>
              ))}
            </ul>
          </Alerte>
        ) : null}

        {avertissements.length > 0 ? (
          <Alerte ton="alerte">
            <ul className="list-inside list-disc space-y-0.5">
              {avertissements.map((anomalie) => (
                <li key={anomalie.code + anomalie.message}>{anomalie.message}</li>
              ))}
            </ul>
          </Alerte>
        ) : null}

        {tranches.length > 0 ? (
          <ul className="space-y-1.5">
            {tranches.map((tranche) => (
              <li
                key={tranche.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-douce border border-bordure px-3 py-2 text-sm"
              >
                <span className="font-medium text-encre">{tranche.label}</span>
                <span className="tabular-nums text-encre-douce">
                  {tranche.min_score} – {tranche.max_score}
                  {tranche.is_passing ? ' · réussite' : ''}
                </span>
                {peutModifier ? (
                  <form action={actionRetrait}>
                    <input type="hidden" name="trancheId" value={tranche.id} />
                    <Bouton variante="discret" taille="petite" type="submit" aria-label={`Retirer ${tranche.label}`}>
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Bouton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-encre-douce">
            Aucune tranche. Un barème par lettres ou par niveaux de maîtrise en exige.
          </p>
        )}

        {etatRetrait.statut === 'erreur' ? (
          <Alerte ton="danger">{etatRetrait.message}</Alerte>
        ) : null}
        {etatDefaut.statut === 'erreur' ? (
          <Alerte ton="danger">{etatDefaut.message}</Alerte>
        ) : null}

        {peutModifier && !bareme.is_default ? (
          <form action={actionDefaut}>
            <input type="hidden" name="baremeId" value={bareme.id} />
            <Bouton variante="discret" taille="petite" type="submit">
              <Star className="size-3.5" aria-hidden="true" />
              Définir comme barème par défaut de l&apos;établissement
            </Bouton>
          </form>
        ) : null}

        {peutModifier ? (
          ouvert ? (
            <form action={actionAjout} className="space-y-3 border-t border-bordure pt-4" noValidate>
              <input type="hidden" name="baremeId" value={bareme.id} />
              {etatAjout.statut === 'erreur' ? (
                <Alerte ton="danger">{etatAjout.message}</Alerte>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Champ label="Libellé" htmlFor={`libelle-${bareme.id}`} obligatoire>
                  <Saisie id={`libelle-${bareme.id}`} name="libelle" required autoComplete="off" />
                </Champ>
                <Champ label="De" htmlFor={`min-${bareme.id}`} obligatoire>
                  <Saisie id={`min-${bareme.id}`} name="minimum" type="number" step="0.01" required />
                </Champ>
                <Champ label="À" htmlFor={`max-${bareme.id}`} obligatoire>
                  <Saisie id={`max-${bareme.id}`} name="maximum" type="number" step="0.01" required />
                </Champ>
              </div>

              <label className="flex items-center gap-2 text-sm text-encre">
                <input type="checkbox" name="reussite" className="size-4 rounded border-bordure" />
                Cette tranche vaut réussite
              </label>

              <div className="flex gap-2">
                <BoutonEnvoi libelle="Ajouter la tranche" enCours="Ajout…" />
                <Bouton variante="discret" type="button" onClick={() => setOuvert(false)}>
                  Annuler
                </Bouton>
              </div>
            </form>
          ) : (
            <Bouton variante="secondaire" taille="petite" onClick={() => setOuvert(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              Ajouter une tranche
            </Bouton>
          )
        ) : null}
      </CorpsCarte>
    </Carte>
  );
}

export function FormulaireCategorie() {
  const [etat, action] = useActionState(creerCategorieAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  return (
    <form action={action} className="space-y-3" noValidate>
      {etat.statut === 'erreur' && !etat.champs ? <Alerte ton="danger">{etat.message}</Alerte> : null}
      {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Champ label="Nom" htmlFor="nomCategorie" erreur={champs['nom']} obligatoire>
          <Saisie id="nomCategorie" name="nom" required autoComplete="off" placeholder="Examen" />
        </Champ>
        <Champ label="Code" htmlFor="codeCategorie" erreur={champs['code']} obligatoire>
          <Saisie id="codeCategorie" name="code" required autoComplete="off" placeholder="EXAMEN" />
        </Champ>
        <Champ label="Poids" htmlFor="poidsCategorie" erreur={champs['poids']} obligatoire>
          <Saisie
            id="poidsCategorie"
            name="poids"
            type="number"
            step="0.25"
            min="0.25"
            defaultValue="1"
            required
          />
        </Champ>
      </div>

      <BoutonEnvoi libelle="Ajouter la catégorie" enCours="Ajout…" />
    </form>
  );
}

/**
 * Coefficients de matière d'une classe.
 *
 * Sans parcours ni filières, c'est la classe qui les porte — manque n° 2 relevé
 * à la relecture de la conception antérieure.
 */
export function FormulaireCoefficients({
  classes,
  matieres,
  baremes,
  classeActive,
  coefficients,
  baremeClasse,
}: {
  classes: Pick<Classe, 'id' | 'name'>[];
  matieres: Pick<Subject, 'id' | 'name'>[];
  baremes: GradingSystem[];
  classeActive: string;
  coefficients: CoefficientMatiere[];
  baremeClasse: string | null;
}) {
  const [etat, action] = useActionState(definirCoefficientAction, ETAT_INITIAL);
  const [etatBareme, actionBareme] = useActionState(definirBaremeClasseAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};
  const router = useRouter();
  // La classe passe par l'URL : les coefficients et le barème affichés sont
  // chargés côté serveur, ils doivent donc suivre le choix.
  const classeId = classeActive;

  return (
    <div className="space-y-4">
      <Champ label="Classe" htmlFor="classeCoef">
        <Liste
          id="classeCoef"
          value={classeId}
          onChange={(evenement) =>
            router.push(
              evenement.target.value ? `/baremes?classe=${evenement.target.value}` : '/baremes',
            )
          }
        >
          <option value="">Sélectionnez une classe</option>
          {classes.map((classe) => (
            <option key={classe.id} value={classe.id}>
              {classe.name}
            </option>
          ))}
        </Liste>
      </Champ>

      {classeId ? (
        <form action={actionBareme} className="space-y-3 rounded-douce border border-bordure p-3">
          <input type="hidden" name="classeId" value={classeId} />
          {etatBareme.statut === 'erreur' ? (
            <Alerte ton="danger">{etatBareme.message}</Alerte>
          ) : null}
          {etatBareme.statut === 'succes' ? (
            <Alerte ton="succes">{etatBareme.message}</Alerte>
          ) : null}

          <Champ
            label="Barème de la classe"
            htmlFor="baremeClasse"
            aide="Il l'emporte sur le barème par défaut de l'établissement, et se laisse surcharger matière par matière."
          >
            <Liste id="baremeClasse" name="baremeId" defaultValue={baremeClasse ?? ''}>
              <option value="">Celui de l&apos;établissement</option>
              {baremes.map((bareme) => (
                <option key={bareme.id} value={bareme.id}>
                  {bareme.name}
                </option>
              ))}
            </Liste>
          </Champ>

          <BoutonEnvoi libelle="Enregistrer le barème" enCours="Enregistrement…" />
        </form>
      ) : null}

      {coefficients.length > 0 ? (
        <ul className="space-y-1.5">
          {coefficients.map((coefficient) => (
            <li
              key={coefficient.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-douce border border-bordure px-3 py-2 text-sm"
            >
              <span className="font-medium text-encre">{coefficient.matiere?.name}</span>
              <span className="tabular-nums text-encre-douce">
                coefficient {coefficient.coefficient}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {classeId ? (
        <form action={action} className="space-y-3" noValidate>
          <input type="hidden" name="classeId" value={classeId} />
          {etat.statut === 'erreur' && !etat.champs ? (
            <Alerte ton="danger">{etat.message}</Alerte>
          ) : null}
          {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Champ label="Matière" htmlFor="matiereCoef" erreur={champs['matiereId']} obligatoire>
              <Liste id="matiereCoef" name="matiereId" required defaultValue="">
                <option value="" disabled>
                  Sélectionnez
                </option>
                {matieres.map((matiere) => (
                  <option key={matiere.id} value={matiere.id}>
                    {matiere.name}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ
              label="Coefficient"
              htmlFor="coefficient"
              erreur={champs['coefficient']}
              obligatoire
            >
              <Saisie
                id="coefficient"
                name="coefficient"
                type="number"
                step="0.25"
                min="0.25"
                defaultValue="1"
                required
              />
            </Champ>
            <Champ
              label="Barème"
              htmlFor="baremeCoef"
              erreur={champs['baremeId']}
              aide="Surcharge celui de la classe."
            >
              <Liste id="baremeCoef" name="baremeId" defaultValue="">
                <option value="">Celui de la classe</option>
                {baremes.map((bareme) => (
                  <option key={bareme.id} value={bareme.id}>
                    {bareme.name}
                  </option>
                ))}
              </Liste>
            </Champ>
          </div>

          <BoutonEnvoi libelle="Enregistrer le coefficient" enCours="Enregistrement…" />
        </form>
      ) : null}
    </div>
  );
}
