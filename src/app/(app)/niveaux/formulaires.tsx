'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Pencil, Plus, RotateCcw, X } from 'lucide-react';
import {
  basculerNiveauAction,
  creerNiveauAction,
  modifierNiveauAction,
} from '@/services/academique.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { Level } from '@/lib/types/database';
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

function Champs({ champs, valeurs, rangDefaut }: { champs: Record<string, string>; valeurs?: Level; rangDefaut?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Champ label="Nom" htmlFor="nom" erreur={champs['nom']} obligatoire>
        <Saisie id="nom" name="nom" required defaultValue={valeurs?.name ?? ''} placeholder="Sixième" erreur={Boolean(champs['nom'])} />
      </Champ>
      <Champ label="Code" htmlFor="code" erreur={champs['code']} obligatoire>
        <Saisie id="code" name="code" required defaultValue={valeurs?.code ?? ''} placeholder="6E" className="uppercase" erreur={Boolean(champs['code'])} />
      </Champ>
      <Champ
        label="Cycle"
        htmlFor="cycle"
        erreur={champs['cycle']}
        aide="Texte libre : primaire, collège, licence…"
      >
        <Saisie id="cycle" name="cycle" defaultValue={valeurs?.stage_label ?? ''} />
      </Champ>
      <Champ
        label="Rang"
        htmlFor="position"
        erreur={champs['position']}
        aide="Ordre de progression, du plus bas au plus élevé."
        obligatoire
      >
        <Saisie
          id="position"
          name="position"
          type="number"
          min={0}
          max={999}
          required
          defaultValue={valeurs?.position ?? rangDefaut ?? 1}
          erreur={Boolean(champs['position'])}
        />
      </Champ>
    </div>
  );
}

export function FormulaireNiveau({ rangDefaut }: { rangDefaut: number }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(creerNiveauAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton onClick={() => setOuvert(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nouveau niveau
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte className="flex items-center justify-between gap-4">
        <TitreCarte>Nouveau niveau</TitreCarte>
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
          <Champs champs={champs} rangDefaut={rangDefaut} />
          <BoutonEnvoi libelle="Créer le niveau" enCours="Création…" />
        </form>
      </CorpsCarte>
    </Carte>
  );
}

export function LigneNiveau({ niveau, peutModifier }: { niveau: Level; peutModifier: boolean }) {
  const [edition, setEdition] = useState(false);
  const [etat, action] = useActionState(modifierNiveauAction, ETAT_INITIAL);
  const [etatBascule, actionBascule] = useActionState(basculerNiveauAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (edition) {
    return (
      <div className="border-b border-bordure p-5 last:border-b-0">
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={niveau.id} />
          {etat.statut === 'erreur' && !etat.champs ? (
            <Alerte ton="danger">{etat.message}</Alerte>
          ) : null}
          <Champs champs={champs} valeurs={niveau} />
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
      <span className="w-8 shrink-0 text-sm tabular-nums text-encre-douce">{niveau.position}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-encre">{niveau.name}</p>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-encre-douce">
            {niveau.code}
          </span>
          {!niveau.is_active ? <Etiquette ton="alerte">Désactivé</Etiquette> : null}
        </div>
        {niveau.stage_label ? (
          <p className="mt-0.5 text-sm text-encre-douce">{niveau.stage_label}</p>
        ) : null}
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
            <input type="hidden" name="id" value={niveau.id} />
            <input type="hidden" name="actif" value={niveau.is_active ? '0' : '1'} />
            <Bouton variante="secondaire" taille="petite" type="submit">
              {niveau.is_active ? (
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
