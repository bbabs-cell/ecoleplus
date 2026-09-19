'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Copy, MailPlus, ShieldBan, ShieldCheck, X } from 'lucide-react';
import {
  changerRoleAction,
  changerStatutAction,
  inviterMembreAction,
  revoquerInvitationAction,
} from '@/services/membres.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { Role } from '@/lib/types/database';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';
import { Carte, CorpsCarte, EnTeteCarte, TitreCarte } from '@/components/ui/carte';
import { Etiquette } from '@/components/ui/etiquette';

interface EtablissementSimple {
  id: string;
  name: string;
}

function BoutonEnvoi({ libelle, enCours }: { libelle: string; enCours: string }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? enCours : libelle}
    </Bouton>
  );
}

function LienInvitation({ chemin }: { chemin: string }) {
  const [copie, setCopie] = useState(false);
  // `window` n'existe qu'au rendu client ; le lien absolu se construit ici.
  const complet = typeof window === 'undefined' ? chemin : `${window.location.origin}${chemin}`;

  return (
    <Alerte ton="succes" titre="Invitation créée">
      <p className="mb-2">
        Aucun e-mail n&apos;est envoyé à ce stade. Transmettez ce lien à la personne invitée — il
        n&apos;est affiché qu&apos;une fois.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-carte px-2 py-1 font-mono text-xs">
          {complet}
        </code>
        <Bouton
          type="button"
          variante="secondaire"
          taille="petite"
          onClick={() => {
            void navigator.clipboard?.writeText(complet).then(() => setCopie(true));
          }}
        >
          <Copy className="size-3.5" aria-hidden="true" />
          {copie ? 'Copié' : 'Copier'}
        </Bouton>
      </div>
    </Alerte>
  );
}

export function FormulaireInvitation({
  roles,
  etablissements,
}: {
  roles: Role[];
  etablissements: EtablissementSimple[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(inviterMembreAction, ETAT_INITIAL);
  const [roleChoisi, setRoleChoisi] = useState('');
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  const role = roles.find((candidat) => candidat.id === roleChoisi);
  const exigeEtablissement = role?.scope === 'ESTABLISHMENT';

  const lien = etat.statut === 'succes' ? etat.donnees?.['chemin'] : undefined;

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {lien ? <LienInvitation chemin={lien} /> : null}
        <Bouton onClick={() => setOuvert(true)}>
          <MailPlus className="size-4" aria-hidden="true" />
          Inviter un membre
        </Bouton>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lien ? <LienInvitation chemin={lien} /> : null}
      <Carte>
        <EnTeteCarte className="flex items-center justify-between gap-4">
          <TitreCarte>Inviter un membre</TitreCarte>
          <Bouton variante="discret" taille="petite" onClick={() => setOuvert(false)}>
            <X className="size-4" aria-hidden="true" />
            Fermer
          </Bouton>
        </EnTeteCarte>
        <CorpsCarte>
          <form action={action} className="space-y-4" noValidate>
            {etat.statut === 'erreur' && !etat.champs ? (
              <Alerte ton="danger">{etat.message}</Alerte>
            ) : null}

            <Champ label="Adresse e-mail" htmlFor="email" erreur={champs['email']} obligatoire>
              <Saisie
                id="email"
                name="email"
                type="email"
                required
                erreur={Boolean(champs['email'])}
              />
            </Champ>

            <Champ label="Rôle" htmlFor="roleId" erreur={champs['roleId']} obligatoire>
              <Liste
                id="roleId"
                name="roleId"
                required
                value={roleChoisi}
                onChange={(evenement) => setRoleChoisi(evenement.target.value)}
                erreur={Boolean(champs['roleId'])}
              >
                <option value="" disabled>
                  Sélectionnez un rôle
                </option>
                {roles.map((candidat) => (
                  <option key={candidat.id} value={candidat.id}>
                    {candidat.label}
                  </option>
                ))}
              </Liste>
            </Champ>

            {role ? <p className="text-xs text-encre-douce">{role.description}</p> : null}

            {exigeEtablissement ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-encre">
                  Établissements <span className="text-danger">*</span>
                </legend>
                <p className="text-xs text-encre-douce">
                  Ce rôle ne donne accès qu&apos;aux établissements cochés.
                </p>
                {etablissements.length === 0 ? (
                  <p className="text-xs text-danger">
                    Créez d&apos;abord un établissement : ce rôle en exige au moins un.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {etablissements.map((etablissement) => (
                      <label
                        key={etablissement.id}
                        className="flex items-center gap-2 text-sm text-encre"
                      >
                        <input
                          type="checkbox"
                          name="etablissements"
                          value={etablissement.id}
                          className="size-4 rounded border-bordure"
                        />
                        {etablissement.name}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            ) : null}

            <BoutonEnvoi libelle="Créer l'invitation" enCours="Création…" />
          </form>
        </CorpsCarte>
      </Carte>
    </div>
  );
}

export function ActionsInvitation({ invitationId }: { invitationId: string }) {
  const [etat, action] = useActionState(revoquerInvitationAction, ETAT_INITIAL);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      {etat.statut === 'erreur' ? (
        <span className="text-xs font-medium text-danger">{etat.message}</span>
      ) : null}
      <Bouton variante="secondaire" taille="petite" type="submit">
        Révoquer
      </Bouton>
    </form>
  );
}

export function ActionsMembre({
  membershipId,
  roleActuelId,
  suspendu,
  roles,
  peutChangerRole,
  peutSuspendre,
  estMoi,
}: {
  membershipId: string;
  roleActuelId: string;
  suspendu: boolean;
  roles: Role[];
  peutChangerRole: boolean;
  peutSuspendre: boolean;
  estMoi: boolean;
}) {
  const [etatRole, actionRole] = useActionState(changerRoleAction, ETAT_INITIAL);
  const [etatStatut, actionStatut] = useActionState(changerStatutAction, ETAT_INITIAL);

  // Nul ne modifie son propre accès : la fonction SQL le refuse déjà, autant ne
  // pas proposer un contrôle voué à l'échec.
  if (estMoi) {
    return <span className="text-xs text-encre-douce">Votre compte</span>;
  }

  const erreur =
    etatRole.statut === 'erreur'
      ? etatRole.message
      : etatStatut.statut === 'erreur'
        ? etatStatut.message
        : null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {peutChangerRole ? (
          <form action={actionRole}>
            <input type="hidden" name="membershipId" value={membershipId} />
            <label htmlFor={`role-${membershipId}`} className="sr-only">
              Rôle du membre
            </label>
            <Liste
              id={`role-${membershipId}`}
              name="roleId"
              defaultValue={roleActuelId}
              onChange={(evenement) => evenement.currentTarget.form?.requestSubmit()}
              className="h-8 py-0 text-xs"
            >
              {roles.map((candidat) => (
                <option key={candidat.id} value={candidat.id}>
                  {candidat.label}
                </option>
              ))}
            </Liste>
          </form>
        ) : null}

        {peutSuspendre ? (
          <form action={actionStatut}>
            <input type="hidden" name="membershipId" value={membershipId} />
            <input type="hidden" name="suspendre" value={suspendu ? '0' : '1'} />
            <Bouton variante="secondaire" taille="petite" type="submit">
              {suspendu ? (
                <>
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  Réactiver
                </>
              ) : (
                <>
                  <ShieldBan className="size-3.5" aria-hidden="true" />
                  Suspendre
                </>
              )}
            </Bouton>
          </form>
        ) : null}

        {suspendu ? <Etiquette ton="alerte">Suspendu</Etiquette> : null}
      </div>
      {erreur ? <p className="text-xs font-medium text-danger">{erreur}</p> : null}
    </div>
  );
}
