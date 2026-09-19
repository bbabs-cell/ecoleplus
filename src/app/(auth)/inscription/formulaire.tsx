'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { inscriptionAction } from '@/services/auth.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" className="w-full" disabled={pending}>
      {pending ? 'Création…' : 'Créer mon compte'}
    </Bouton>
  );
}

export function FormulaireInscription() {
  const [etat, action] = useActionState(inscriptionAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (etat.statut === 'succes') {
    return (
      <Alerte ton="succes" titre="Compte créé">
        {etat.message}
      </Alerte>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {etat.statut === 'erreur' && !etat.champs ? (
        <Alerte ton="danger">{etat.message}</Alerte>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ label="Prénom" htmlFor="prenom" erreur={champs['prenom']} obligatoire>
          <Saisie
            id="prenom"
            name="prenom"
            autoComplete="given-name"
            required
            erreur={Boolean(champs['prenom'])}
          />
        </Champ>
        <Champ label="Nom" htmlFor="nom" erreur={champs['nom']} obligatoire>
          <Saisie
            id="nom"
            name="nom"
            autoComplete="family-name"
            required
            erreur={Boolean(champs['nom'])}
          />
        </Champ>
      </div>

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

      <Champ
        label="Mot de passe"
        htmlFor="motDePasse"
        erreur={champs['motDePasse']}
        aide="Au moins 12 caractères. Une phrase longue vaut mieux qu'un mot compliqué."
        obligatoire
      >
        <Saisie
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          erreur={Boolean(champs['motDePasse'])}
        />
      </Champ>

      <BoutonEnvoi />

      <p className="text-center text-sm text-encre-douce">
        Déjà inscrit ?{' '}
        <Link href="/connexion" className="font-medium text-primaire underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
