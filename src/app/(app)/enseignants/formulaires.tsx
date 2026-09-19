'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Pencil, Plus, RotateCcw, X } from 'lucide-react';
import {
  basculerEnseignantAction,
  creerEnseignantAction,
  modifierEnseignantAction,
} from '@/services/enseignants.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { NameDisplayFormat, Teacher } from '@/lib/types/database';
import { nomAffiche } from '@/lib/format';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Saisie } from '@/components/ui/champ';
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

function Champs({ champs, valeurs }: { champs: Record<string, string>; valeurs?: Teacher }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Champ label="Prénom" htmlFor="prenom" erreur={champs['prenom']}>
        <Saisie id="prenom" name="prenom" defaultValue={valeurs?.given_name ?? ''} autoComplete="off" />
      </Champ>
      <Champ label="Nom" htmlFor="nom" erreur={champs['nom']} obligatoire>
        <Saisie id="nom" name="nom" required defaultValue={valeurs?.family_name ?? ''} erreur={Boolean(champs['nom'])} autoComplete="off" />
      </Champ>
      <Champ label="Adresse e-mail" htmlFor="email" erreur={champs['email']}>
        <Saisie id="email" name="email" type="email" defaultValue={valeurs?.email ?? ''} erreur={Boolean(champs['email'])} />
      </Champ>
      <Champ label="Téléphone" htmlFor="telephone" erreur={champs['telephone']}>
        <Saisie id="telephone" name="telephone" type="tel" defaultValue={valeurs?.phone ?? ''} />
      </Champ>
      <Champ label="Matricule" htmlFor="code" erreur={champs['code']}>
        <Saisie id="code" name="code" defaultValue={valeurs?.staff_code ?? ''} className="uppercase" />
      </Champ>
      <Champ label="Date d'embauche" htmlFor="dateEmbauche" erreur={champs['dateEmbauche']}>
        <Saisie id="dateEmbauche" name="dateEmbauche" type="date" defaultValue={valeurs?.hired_on ?? ''} />
      </Champ>
    </div>
  );
}

export function FormulaireEnseignant() {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(creerEnseignantAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton onClick={() => setOuvert(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nouvel enseignant
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte className="flex items-center justify-between gap-4">
        <TitreCarte>Nouvel enseignant</TitreCarte>
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
            Un enseignant n&apos;a pas besoin de compte pour être enregistré. Pour lui ouvrir un
            accès, invitez-le depuis la page Membres.
          </p>
          <BoutonEnvoi libelle="Ajouter l'enseignant" enCours="Ajout…" />
        </form>
      </CorpsCarte>
    </Carte>
  );
}

export function LigneEnseignant({
  enseignant,
  format,
  peutModifier,
}: {
  enseignant: Teacher;
  format: NameDisplayFormat;
  peutModifier: boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [etat, action] = useActionState(modifierEnseignantAction, ETAT_INITIAL);
  const [etatBascule, actionBascule] = useActionState(basculerEnseignantAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};
  const actif = enseignant.status === 'ACTIVE';

  if (edition) {
    return (
      <div className="border-b border-bordure p-5 last:border-b-0">
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={enseignant.id} />
          {etat.statut === 'erreur' && !etat.champs ? (
            <Alerte ton="danger">{etat.message}</Alerte>
          ) : null}
          <Champs champs={champs} valeurs={enseignant} />
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
          <p className="font-medium text-encre">{nomAffiche(enseignant, format)}</p>
          {enseignant.staff_code ? (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-encre-douce">
              {enseignant.staff_code}
            </span>
          ) : null}
          {enseignant.profile_id ? <Etiquette ton="primaire">Compte actif</Etiquette> : null}
          {!actif ? <Etiquette ton="alerte">Désactivé</Etiquette> : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-encre-douce">
          {[enseignant.email, enseignant.phone].filter(Boolean).join(' · ') || '—'}
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
            <input type="hidden" name="id" value={enseignant.id} />
            <input type="hidden" name="actif" value={actif ? '0' : '1'} />
            <Bouton variante="secondaire" taille="petite" type="submit">
              {actif ? (
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
  );
}
