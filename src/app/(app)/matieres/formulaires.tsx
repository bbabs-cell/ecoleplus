'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  creerMatiereAction,
  modifierMatiereAction,
  supprimerMatiereAction,
} from '@/services/academique.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { Subject } from '@/lib/types/database';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';
import { Carte, CorpsCarte, EnTeteCarte, TitreCarte } from '@/components/ui/carte';

function BoutonEnvoi({ libelle, enCours }: { libelle: string; enCours: string }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? enCours : libelle}
    </Bouton>
  );
}

function Champs({ champs, valeurs }: { champs: Record<string, string>; valeurs?: Subject }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ label="Nom" htmlFor="nom" erreur={champs['nom']} obligatoire>
          <Saisie id="nom" name="nom" required defaultValue={valeurs?.name ?? ''} placeholder="Mathématiques" erreur={Boolean(champs['nom'])} />
        </Champ>
        <Champ label="Code" htmlFor="code" erreur={champs['code']} obligatoire>
          <Saisie id="code" name="code" required defaultValue={valeurs?.code ?? ''} placeholder="MATH" className="uppercase" erreur={Boolean(champs['code'])} />
        </Champ>
      </div>
      <Champ label="Description" htmlFor="description" erreur={champs['description']}>
        <Saisie id="description" name="description" defaultValue={valeurs?.description ?? ''} />
      </Champ>
    </>
  );
}

export function FormulaireMatiere() {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(creerMatiereAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton onClick={() => setOuvert(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nouvelle matière
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte className="flex items-center justify-between gap-4">
        <TitreCarte>Nouvelle matière</TitreCarte>
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
          <Champs champs={champs} />
          <p className="text-xs text-encre-douce">
            Les coefficients et barèmes ne sont pas saisis ici : ils dépendent du système de
            notation, qui arrive en phase 3.
          </p>
          <BoutonEnvoi libelle="Créer la matière" enCours="Création…" />
        </form>
      </CorpsCarte>
    </Carte>
  );
}

export function LigneMatiere({ matiere, peutModifier }: { matiere: Subject; peutModifier: boolean }) {
  const [edition, setEdition] = useState(false);
  const [etat, action] = useActionState(modifierMatiereAction, ETAT_INITIAL);
  const [etatSuppression, actionSuppression] = useActionState(supprimerMatiereAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (edition) {
    return (
      <div className="border-b border-bordure p-5 last:border-b-0">
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={matiere.id} />
          {etat.statut === 'erreur' && !etat.champs ? (
            <Alerte ton="danger">{etat.message}</Alerte>
          ) : null}
          <Champs champs={champs} valeurs={matiere} />
          <div className="flex gap-2">
            <BoutonEnvoi libelle="Enregistrer" enCours="Enregistrement…" />
            <Bouton variante="secondaire" type="button" onClick={() => setEdition(false)}>
              Annuler
            </Bouton>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-bordure p-5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-encre">{matiere.name}</p>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-encre-douce">
            {matiere.code}
          </span>
        </div>
        {matiere.description ? (
          <p className="mt-0.5 truncate text-sm text-encre-douce">{matiere.description}</p>
        ) : null}
        {etatSuppression.statut === 'erreur' ? (
          <p className="mt-1 text-xs font-medium text-danger">{etatSuppression.message}</p>
        ) : null}
      </div>

      {peutModifier ? (
        <div className="flex gap-2">
          <Bouton variante="secondaire" taille="petite" onClick={() => setEdition(true)}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Modifier
          </Bouton>
          <form action={actionSuppression}>
            <input type="hidden" name="id" value={matiere.id} />
            <Bouton variante="secondaire" taille="petite" type="submit">
              <Trash2 className="size-3.5" aria-hidden="true" />
              Supprimer
            </Bouton>
          </form>
        </div>
      ) : null}
    </div>
  );
}
