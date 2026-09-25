'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { demanderReinitialisationAction } from '@/services/auth.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" className="w-full" disabled={pending}>
      {pending ? 'Envoi…' : 'Envoyer le lien'}
    </Bouton>
  );
}

export function FormulaireMotDePasseOublie() {
  const [etat, action] = useActionState(demanderReinitialisationAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  // Une fois la demande partie, le formulaire s'efface : le réafficher
  // inviterait à réessayer, alors que la réponse serait identique.
  if (etat.statut === 'succes') {
    return (
      <div className="space-y-4">
        <Alerte ton="succes">{etat.message}</Alerte>
        <p className="text-center text-sm text-encre-douce">
          <Link href="/connexion" className="font-medium text-primaire underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {etat.statut === 'erreur' && !etat.champs ? (
        <Alerte ton="danger">{etat.message}</Alerte>
      ) : null}

      <Champ label="Adresse e-mail" htmlFor="email" erreur={champs['email']} obligatoire>
        <Saisie
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          erreur={Boolean(champs['email'])}
        />
      </Champ>

      <BoutonEnvoi />

      <p className="text-center text-sm text-encre-douce">
        <Link href="/connexion" className="font-medium text-primaire underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
