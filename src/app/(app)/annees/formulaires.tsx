'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CalendarCheck, Plus, Trash2, X } from 'lucide-react';
import {
  creerAnneeAction,
  creerPeriodeAction,
  definirAnneeCouranteAction,
  supprimerPeriodeAction,
} from '@/services/academique.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { AcademicTerm } from '@/lib/types/database';
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

export function FormulaireAnnee() {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(creerAnneeAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton onClick={() => setOuvert(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nouvelle année
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte className="flex items-center justify-between gap-4">
        <TitreCarte>Nouvelle année académique</TitreCarte>
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

          <Champ
            label="Libellé"
            htmlFor="nom"
            erreur={champs['nom']}
            aide="Libre : « 2026-2027 », « 1447 », « Année 3 »…"
            obligatoire
          >
            <Saisie id="nom" name="nom" required placeholder="2026-2027" erreur={Boolean(champs['nom'])} />
          </Champ>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Début" htmlFor="debut" erreur={champs['debut']} obligatoire>
              <Saisie id="debut" name="debut" type="date" required erreur={Boolean(champs['debut'])} />
            </Champ>
            <Champ label="Fin" htmlFor="fin" erreur={champs['fin']} obligatoire>
              <Saisie id="fin" name="fin" type="date" required erreur={Boolean(champs['fin'])} />
            </Champ>
          </div>

          <BoutonEnvoi libelle="Créer l'année" enCours="Création…" />
        </form>
      </CorpsCarte>
    </Carte>
  );
}

export function BoutonAnneeCourante({ anneeId }: { anneeId: string }) {
  const [etat, action] = useActionState(definirAnneeCouranteAction, ETAT_INITIAL);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="anneeId" value={anneeId} />
      {etat.statut === 'erreur' ? (
        <span className="text-xs font-medium text-danger">{etat.message}</span>
      ) : null}
      <Bouton variante="secondaire" taille="petite" type="submit">
        <CalendarCheck className="size-3.5" aria-hidden="true" />
        Définir comme courante
      </Bouton>
    </form>
  );
}

export function PeriodesAnnee({
  anneeId,
  periodes,
  peutModifier,
}: {
  anneeId: string;
  periodes: AcademicTerm[];
  peutModifier: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(creerPeriodeAction, ETAT_INITIAL);
  const [etatSuppression, actionSuppression] = useActionState(supprimerPeriodeAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  return (
    <div className="space-y-3 border-t border-bordure pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-encre-douce">
          Découpage {periodes.length > 0 ? `· ${periodes.length} période${periodes.length > 1 ? 's' : ''}` : ''}
        </p>
        {peutModifier && !ouvert ? (
          <Bouton variante="discret" taille="petite" onClick={() => setOuvert(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            Ajouter une période
          </Bouton>
        ) : null}
      </div>

      {periodes.length === 0 && !ouvert ? (
        <p className="text-sm text-encre-douce">
          Aucune période. Trimestre, semestre, quarter : le découpage est libre.
        </p>
      ) : null}

      {periodes.length > 0 ? (
        <ul className="space-y-1.5">
          {periodes.map((periode) => (
            <li key={periode.id} className="flex items-center gap-3 text-sm">
              <span className="w-6 shrink-0 text-xs tabular-nums text-encre-douce">
                {periode.position}
              </span>
              <span className="min-w-0 flex-1 truncate text-encre">
                {periode.name}
                {periode.kind_label ? (
                  <span className="text-encre-douce"> · {periode.kind_label}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-encre-douce">
                {periode.starts_on} → {periode.ends_on}
              </span>
              {peutModifier ? (
                <form action={actionSuppression}>
                  <input type="hidden" name="periodeId" value={periode.id} />
                  <button
                    type="submit"
                    className="flex size-11 shrink-0 items-center justify-center rounded text-encre-douce transition-colors hover:bg-surface-2 hover:text-danger lg:size-8"
                    aria-label={`Supprimer la période ${periode.name}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {etatSuppression.statut === 'erreur' ? (
        <p className="text-xs font-medium text-danger">{etatSuppression.message}</p>
      ) : null}

      {ouvert ? (
        <form action={action} className="space-y-3 rounded-douce bg-surface-2 p-3" noValidate>
          <input type="hidden" name="anneeId" value={anneeId} />
          {etat.statut === 'erreur' && !etat.champs ? (
            <Alerte ton="danger">{etat.message}</Alerte>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Champ label="Nom" htmlFor={`p-nom-${anneeId}`} erreur={champs['nom']} obligatoire>
              <Saisie id={`p-nom-${anneeId}`} name="nom" required placeholder="Trimestre 1" />
            </Champ>
            <Champ
              label="Type"
              htmlFor={`p-type-${anneeId}`}
              erreur={champs['type']}
              aide="Trimestre, semestre, quarter…"
            >
              <Saisie id={`p-type-${anneeId}`} name="type" placeholder="trimestre" />
            </Champ>
            <Champ label="Rang" htmlFor={`p-pos-${anneeId}`} erreur={champs['position']} obligatoire>
              <Saisie id={`p-pos-${anneeId}`} name="position" type="number" min={1} max={24} defaultValue={periodes.length + 1} required />
            </Champ>
            <div />
            <Champ label="Début" htmlFor={`p-debut-${anneeId}`} erreur={champs['debut']} obligatoire>
              <Saisie id={`p-debut-${anneeId}`} name="debut" type="date" required />
            </Champ>
            <Champ label="Fin" htmlFor={`p-fin-${anneeId}`} erreur={champs['fin']} obligatoire>
              <Saisie id={`p-fin-${anneeId}`} name="fin" type="date" required />
            </Champ>
          </div>

          <div className="flex gap-2">
            <BoutonEnvoi libelle="Ajouter" enCours="Ajout…" />
            <Bouton variante="secondaire" type="button" onClick={() => setOuvert(false)}>
              Fermer
            </Bouton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
