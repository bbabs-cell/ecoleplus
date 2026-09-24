'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { BadgeCheck, Send } from 'lucide-react';
import {
  definirRangAction,
  publierBulletinAction,
  verifierBulletinAction,
  verifierClasseAction,
} from '@/services/bulletins.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import { Bouton } from '@/components/ui/bouton';
import { Alerte } from '@/components/ui/alerte';
import { Champ, Saisie } from '@/components/ui/champ';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';

function BoutonEnvoi({
  libelle,
  enCours,
  variante = 'primaire',
}: {
  libelle: string;
  enCours: string;
  variante?: 'primaire' | 'secondaire';
}) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" variante={variante} disabled={pending}>
      {pending ? enCours : libelle}
    </Bouton>
  );
}

/** Vérification de toute une classe : c'est ainsi que le travail se fait. */
export function VerifierClasse({
  classeId,
  periodeId,
  effectif,
}: {
  classeId: string;
  periodeId: string;
  effectif: number;
}) {
  const [etat, action] = useActionState(verifierClasseAction, ETAT_INITIAL);

  return (
    <div className="space-y-2">
      {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}
      {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
      <form action={action}>
        <input type="hidden" name="classeId" value={classeId} />
        <input type="hidden" name="periodeId" value={periodeId} />
        <Bouton type="submit">
          <BadgeCheck className="size-4" aria-hidden="true" />
          Vérifier les {effectif} bulletin{effectif > 1 ? 's' : ''} de la classe
        </Bouton>
      </form>
    </div>
  );
}

export function VerifierUnBulletin({
  inscriptionId,
  periodeId,
}: {
  inscriptionId: string;
  periodeId: string;
}) {
  const [etat, action] = useActionState(verifierBulletinAction, ETAT_INITIAL);

  return (
    <form action={action} className="inline">
      <input type="hidden" name="inscriptionId" value={inscriptionId} />
      <input type="hidden" name="periodeId" value={periodeId} />
      {etat.statut === 'erreur' ? (
        <span className="text-xs font-medium text-danger">{etat.message}</span>
      ) : (
        <BoutonEnvoi libelle="Vérifier" enCours="…" variante="secondaire" />
      )}
    </form>
  );
}

/**
 * Publication d'un bulletin.
 *
 * Une republication crée une nouvelle version sans effacer la précédente — la
 * famille a déjà reçu celle-là — et exige donc un motif.
 */
export function PublierBulletin({
  bulletinId,
  dejaPublie,
}: {
  bulletinId: string;
  dejaPublie: boolean;
}) {
  const [etat, action] = useActionState(publierBulletinAction, ETAT_INITIAL);
  const [ouvert, setOuvert] = useState(false);

  if (dejaPublie && !ouvert) {
    return (
      <div className="space-y-2">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton variante="secondaire" onClick={() => setOuvert(true)}>
          <Send className="size-4" aria-hidden="true" />
          Republier en nouvelle version
        </Bouton>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bulletinId" value={bulletinId} />
      {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}
      {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}

      {dejaPublie ? (
        <Champ
          label="Motif de la republication"
          htmlFor="raison"
          aide="La version précédente reste conservée telle qu'elle a été remise."
          obligatoire
        >
          <Saisie
            id="raison"
            name="raison"
            required
            placeholder="Correction de la note de mathématiques"
          />
        </Champ>
      ) : null}

      <div className="flex gap-2">
        <BoutonEnvoi
          libelle={dejaPublie ? 'Republier' : 'Publier le bulletin'}
          enCours="Publication…"
        />
        {dejaPublie ? (
          <Bouton variante="discret" type="button" onClick={() => setOuvert(false)}>
            Annuler
          </Bouton>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Le rang au bulletin.
 *
 * Désactivé par défaut : de nombreux systèmes éducatifs proscrivent le
 * classement des apprenants, et rien ici ne le suppose souhaitable.
 */
export function ReglageRang({ actif }: { actif: boolean }) {
  const [etat, action] = useActionState(definirRangAction, ETAT_INITIAL);

  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte>Rang au bulletin</TitreCarte>
        <SousTitreCarte>
          Réglage de l&apos;établissement, désactivé par défaut. De nombreux systèmes éducatifs
          proscrivent le classement des apprenants. Deux moyennes égales partagent le même rang.
        </SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte>
        <form action={action} className="flex flex-wrap items-center gap-4">
          {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}
          {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}

          <label className="flex min-h-11 items-center gap-2 text-sm text-encre">
            <input
              type="checkbox"
              name="rangActif"
              defaultChecked={actif}
              className="size-4 rounded border-bordure"
            />
            Faire figurer le rang sur les bulletins
          </label>
          <BoutonEnvoi libelle="Enregistrer" enCours="…" variante="secondaire" />
        </form>
      </CorpsCarte>
    </Carte>
  );
}
