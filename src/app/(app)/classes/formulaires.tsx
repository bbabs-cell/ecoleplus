'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import {
  basculerClasseAction,
  creerAffectationAction,
  creerClasseAction,
  modifierClasseAction,
  supprimerAffectationAction,
} from '@/services/classes.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { Level, NameDisplayFormat, Subject, Teacher } from '@/lib/types/database';
import type { AffectationDetaillee, ClasseDetaillee } from '@/services/classes';
import { nomAffiche } from '@/lib/format';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';
import { Carte, CorpsCarte, EnTeteCarte, TitreCarte } from '@/components/ui/carte';
import { Etiquette } from '@/components/ui/etiquette';

function BoutonEnvoi({ libelle, enCours }: { libelle: string; enCours: string }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? enCours : libelle}
    </Bouton>
  );
}

function Champs({
  champs,
  valeurs,
  niveaux,
  enseignants,
  format,
}: {
  champs: Record<string, string>;
  valeurs?: ClasseDetaillee;
  niveaux: Level[];
  enseignants: Teacher[];
  format: NameDisplayFormat;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Champ label="Nom" htmlFor="nom" erreur={champs['nom']} obligatoire>
        <Saisie id="nom" name="nom" required defaultValue={valeurs?.name ?? ''} placeholder="Sixième A" erreur={Boolean(champs['nom'])} />
      </Champ>
      <Champ label="Code" htmlFor="code" erreur={champs['code']} obligatoire>
        <Saisie id="code" name="code" required defaultValue={valeurs?.code ?? ''} placeholder="6A" className="uppercase" erreur={Boolean(champs['code'])} />
      </Champ>
      <Champ label="Niveau" htmlFor="niveauId" erreur={champs['niveauId']} obligatoire>
        <Liste id="niveauId" name="niveauId" required defaultValue={valeurs?.level_id ?? ''} erreur={Boolean(champs['niveauId'])}>
          <option value="" disabled>
            Sélectionnez un niveau
          </option>
          {niveaux.map((niveau) => (
            <option key={niveau.id} value={niveau.id}>
              {niveau.name}
            </option>
          ))}
        </Liste>
      </Champ>
      <Champ
        label="Effectif maximal"
        htmlFor="capacite"
        erreur={champs['capacite']}
        aide="Laisser vide pour ne pas plafonner."
      >
        <Saisie id="capacite" name="capacite" type="number" min={1} max={2000} defaultValue={valeurs?.capacity ?? ''} />
      </Champ>
      <Champ label="Professeur principal" htmlFor="enseignantPrincipalId" erreur={champs['enseignantPrincipalId']}>
        <Liste id="enseignantPrincipalId" name="enseignantPrincipalId" defaultValue={valeurs?.main_teacher_id ?? ''}>
          <option value="">Aucun</option>
          {enseignants.map((enseignant) => (
            <option key={enseignant.id} value={enseignant.id}>
              {nomAffiche(enseignant, format)}
            </option>
          ))}
        </Liste>
      </Champ>
    </div>
  );
}

export function FormulaireClasse({
  anneeId,
  niveaux,
  enseignants,
  format,
}: {
  anneeId: string;
  niveaux: Level[];
  enseignants: Teacher[];
  format: NameDisplayFormat;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(creerClasseAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (niveaux.length === 0) {
    return (
      <Alerte ton="alerte" titre="Définissez d&apos;abord vos niveaux">
        Une classe se rattache à un niveau. Créez-en au moins un dans la page Niveaux.
      </Alerte>
    );
  }

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton onClick={() => setOuvert(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nouvelle classe
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte className="flex items-center justify-between gap-4">
        <TitreCarte>Nouvelle classe</TitreCarte>
        <Bouton variante="discret" taille="petite" onClick={() => setOuvert(false)}>
          <X className="size-4" aria-hidden="true" />
          Annuler
        </Bouton>
      </EnTeteCarte>
      <CorpsCarte>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="anneeId" value={anneeId} />
          {etat.statut === 'erreur' && !etat.champs ? (
            <Alerte ton="danger">{etat.message}</Alerte>
          ) : null}
          <Champs champs={champs} niveaux={niveaux} enseignants={enseignants} format={format} />
          <BoutonEnvoi libelle="Créer la classe" enCours="Création…" />
        </form>
      </CorpsCarte>
    </Carte>
  );
}

export function CarteClasse({
  classe,
  affectations,
  niveaux,
  enseignants,
  matieres,
  format,
  peutModifier,
}: {
  classe: ClasseDetaillee;
  affectations: AffectationDetaillee[];
  niveaux: Level[];
  enseignants: Teacher[];
  matieres: Subject[];
  format: NameDisplayFormat;
  peutModifier: boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [affectationOuverte, setAffectationOuverte] = useState(false);
  const [etat, action] = useActionState(modifierClasseAction, ETAT_INITIAL);
  const [etatBascule, actionBascule] = useActionState(basculerClasseAction, ETAT_INITIAL);
  const [etatAffectation, actionAffectation] = useActionState(creerAffectationAction, ETAT_INITIAL);
  const [etatRetrait, actionRetrait] = useActionState(supprimerAffectationAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  const pleine = classe.capacity !== null && classe.effectif >= classe.capacity;

  return (
    <Carte>
      <CorpsCarte className="space-y-3">
        {edition ? (
          <form action={action} className="space-y-4" noValidate>
            <input type="hidden" name="id" value={classe.id} />
            {etat.statut === 'erreur' && !etat.champs ? (
              <Alerte ton="danger">{etat.message}</Alerte>
            ) : null}
            <Champs champs={champs} valeurs={classe} niveaux={niveaux} enseignants={enseignants} format={format} />
            <div className="flex gap-2">
              <BoutonEnvoi libelle="Enregistrer" enCours="Enregistrement…" />
              <Bouton variante="secondaire" type="button" onClick={() => setEdition(false)}>
                Annuler
              </Bouton>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-encre">{classe.name}</h2>
                <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-encre-douce">
                  {classe.code}
                </span>
                {classe.niveau ? <Etiquette>{classe.niveau.name}</Etiquette> : null}
                {!classe.is_active ? <Etiquette ton="alerte">Désactivée</Etiquette> : null}
                {pleine ? <Etiquette ton="danger">Complète</Etiquette> : null}
              </div>
              <p className="mt-0.5 text-sm text-encre-douce">
                {classe.effectif} inscrit{classe.effectif > 1 ? 's' : ''}
                {classe.capacity !== null ? ` sur ${classe.capacity}` : ''}
                {classe.enseignantPrincipal
                  ? ` · ${nomAffiche(classe.enseignantPrincipal, format)}`
                  : ' · sans professeur principal'}
              </p>
              {etatBascule.statut === 'erreur' ? (
                <p className="mt-1 text-xs font-medium text-danger">{etatBascule.message}</p>
              ) : null}
            </div>

            {peutModifier ? (
              <div className="flex gap-2">
                <Bouton variante="secondaire" taille="petite" onClick={() => setEdition(true)}>
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Modifier
                </Bouton>
                <form action={actionBascule}>
                  <input type="hidden" name="id" value={classe.id} />
                  <input type="hidden" name="actif" value={classe.is_active ? '0' : '1'} />
                  <Bouton variante="secondaire" taille="petite" type="submit">
                    {classe.is_active ? (
                      'Désactiver'
                    ) : (
                      <>
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        Réactiver
                      </>
                    )}
                  </Bouton>
                </form>
              </div>
            ) : null}
          </div>
        )}

        <div className="space-y-2 border-t border-bordure pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-encre-douce">
              Enseignements
              {affectations.length > 0 ? ` · ${affectations.length}` : ''}
            </p>
            {peutModifier && !affectationOuverte && matieres.length > 0 && enseignants.length > 0 ? (
              <Bouton variante="discret" taille="petite" onClick={() => setAffectationOuverte(true)}>
                <Plus className="size-3.5" aria-hidden="true" />
                Affecter une matière
              </Bouton>
            ) : null}
          </div>

          {affectations.length === 0 && !affectationOuverte ? (
            <p className="text-sm text-encre-douce">
              {matieres.length === 0 || enseignants.length === 0
                ? 'Créez au moins une matière et un enseignant pour pouvoir affecter.'
                : 'Aucune matière affectée à cette classe.'}
            </p>
          ) : null}

          {affectations.length > 0 ? (
            <ul className="space-y-1.5">
              {affectations.map((affectation) => (
                <li key={affectation.id} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-encre">
                    {affectation.matiere?.name ?? 'Matière supprimée'}
                    <span className="text-encre-douce">
                      {affectation.enseignant
                        ? ` · ${nomAffiche(affectation.enseignant, format)}`
                        : ''}
                    </span>
                  </span>
                  {peutModifier ? (
                    <form action={actionRetrait}>
                      <input type="hidden" name="id" value={affectation.id} />
                      <button
                        type="submit"
                        className="rounded p-1 text-encre-douce transition-colors hover:bg-surface-2 hover:text-danger"
                        aria-label="Retirer cette affectation"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {etatRetrait.statut === 'erreur' ? (
            <p className="text-xs font-medium text-danger">{etatRetrait.message}</p>
          ) : null}

          {affectationOuverte ? (
            <form action={actionAffectation} className="space-y-3 rounded-douce bg-surface-2 p-3" noValidate>
              <input type="hidden" name="classeId" value={classe.id} />
              {etatAffectation.statut === 'erreur' ? (
                <Alerte ton="danger">{etatAffectation.message}</Alerte>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Champ label="Matière" htmlFor={`m-${classe.id}`}>
                  <Liste id={`m-${classe.id}`} name="matiereId" required defaultValue="">
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
                <Champ label="Enseignant" htmlFor={`e-${classe.id}`}>
                  <Liste id={`e-${classe.id}`} name="enseignantId" required defaultValue="">
                    <option value="" disabled>
                      Sélectionnez
                    </option>
                    {enseignants.map((enseignant) => (
                      <option key={enseignant.id} value={enseignant.id}>
                        {nomAffiche(enseignant, format)}
                      </option>
                    ))}
                  </Liste>
                </Champ>
              </div>

              <div className="flex gap-2">
                <BoutonEnvoi libelle="Affecter" enCours="Affectation…" />
                <Bouton variante="secondaire" type="button" onClick={() => setAffectationOuverte(false)}>
                  Fermer
                </Bouton>
              </div>
            </form>
          ) : null}
        </div>
      </CorpsCarte>
    </Carte>
  );
}
