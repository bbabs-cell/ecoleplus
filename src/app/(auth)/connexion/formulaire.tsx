'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { connexionAction } from '@/services/auth.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" className="w-full" disabled={pending}>
      {pending ? 'Connexion…' : 'Se connecter'}
    </Bouton>
  );
}

export function FormulaireConnexion({ suite }: { suite: string }) {
  const [etat, action] = useActionState(connexionAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="suite" value={suite} />

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

      <Champ label="Mot de passe" htmlFor="motDePasse" erreur={champs['motDePasse']} obligatoire>
        <Saisie
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
          erreur={Boolean(champs['motDePasse'])}
        />
      </Champ>

      <BoutonEnvoi />

      <p className="text-center text-sm text-encre-douce">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="font-medium text-primaire underline">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
