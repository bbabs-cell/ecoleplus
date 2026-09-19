'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Archive, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import {
  archiverEtablissementAction,
  creerEtablissementAction,
  modifierEtablissementAction,
} from '@/services/etablissements.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { Establishment } from '@/lib/types/database';
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

function ChampsEtablissement({
  champs,
  valeurs,
}: {
  champs: Record<string, string>;
  valeurs?: Establishment;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Champ label="Nom" htmlFor="nom" erreur={champs['nom']} obligatoire>
        <Saisie id="nom" name="nom" required defaultValue={valeurs?.name ?? ''} erreur={Boolean(champs['nom'])} />
      </Champ>

      <Champ
        label="Code"
        htmlFor="code"
        erreur={champs['code']}
        aide="Identifiant court, unique dans l'organisation."
        obligatoire
      >
        <Saisie
          id="code"
          name="code"
          required
          defaultValue={valeurs?.code ?? ''}
          placeholder="LYC-NORD"
          className="uppercase"
          erreur={Boolean(champs['code'])}
        />
      </Champ>

      <Champ
        label="Type"
        htmlFor="type"
        erreur={champs['type']}
        aide="Texte libre : maternelle, collège, faculté, centre de formation…"
      >
        <Saisie id="type" name="type" defaultValue={valeurs?.kind_label ?? ''} erreur={Boolean(champs['type'])} />
      </Champ>

      <Champ label="Ville" htmlFor="ville" erreur={champs['ville']}>
        <Saisie id="ville" name="ville" defaultValue={valeurs?.city ?? ''} erreur={Boolean(champs['ville'])} />
      </Champ>

      <Champ label="Téléphone" htmlFor="telephone" erreur={champs['telephone']}>
        <Saisie
          id="telephone"
          name="telephone"
          type="tel"
          defaultValue={valeurs?.phone ?? ''}
          erreur={Boolean(champs['telephone'])}
        />
      </Champ>

      <Champ label="Adresse e-mail" htmlFor="email" erreur={champs['email']}>
        <Saisie
          id="email"
          name="email"
          type="email"
          defaultValue={valeurs?.email ?? ''}
          erreur={Boolean(champs['email'])}
        />
      </Champ>
    </div>
  );
}

export function FormulaireCreation() {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(creerEtablissementAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton onClick={() => setOuvert(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nouvel établissement
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte className="flex items-center justify-between gap-4">
        <TitreCarte>Nouvel établissement</TitreCarte>
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
          <ChampsEtablissement champs={champs} />
          <BoutonEnvoi libelle="Créer l'établissement" enCours="Création…" />
        </form>
      </CorpsCarte>
    </Carte>
  );
}

export function LigneEtablissement({
  etablissement,
  peutModifier,
}: {
  etablissement: Establishment;
  peutModifier: boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [etat, action] = useActionState(modifierEtablissementAction, ETAT_INITIAL);
  const [etatArchive, actionArchive] = useActionState(archiverEtablissementAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};
  const archive = etablissement.status === 'ARCHIVED';

  if (edition) {
    return (
      <div className="border-b border-bordure p-5 last:border-b-0">
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={etablissement.id} />
          {etat.statut === 'erreur' && !etat.champs ? (
            <Alerte ton="danger">{etat.message}</Alerte>
          ) : null}
          <ChampsEtablissement champs={champs} valeurs={etablissement} />
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
          <p className="font-medium text-encre">{etablissement.name}</p>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-encre-douce">
            {etablissement.code}
          </span>
          {archive ? (
            <span className="rounded-full border border-bordure bg-surface-2 px-2 py-0.5 text-xs text-encre-douce">
              Archivé
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-encre-douce">
          {[etablissement.kind_label, etablissement.city].filter(Boolean).join(' · ') || '—'}
        </p>
        {etat.statut === 'succes' ? (
          <p className="mt-1 text-xs font-medium text-succes">{etat.message}</p>
        ) : null}
        {etatArchive.statut === 'erreur' ? (
          <p className="mt-1 text-xs font-medium text-danger">{etatArchive.message}</p>
        ) : null}
      </div>

      {peutModifier ? (
        <div className="flex gap-2">
          {!archive ? (
            <Bouton variante="secondaire" taille="petite" onClick={() => setEdition(true)}>
              <Pencil className="size-3.5" aria-hidden="true" />
              Modifier
            </Bouton>
          ) : null}
          <form action={actionArchive}>
            <input type="hidden" name="id" value={etablissement.id} />
            <input type="hidden" name="archiver" value={archive ? '0' : '1'} />
            <Bouton variante="secondaire" taille="petite" type="submit">
              {archive ? (
                <>
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Réactiver
                </>
              ) : (
                <>
                  <Archive className="size-3.5" aria-hidden="true" />
                  Archiver
                </>
              )}
            </Bouton>
          </form>
        </div>
      ) : null}
    </div>
  );
}
