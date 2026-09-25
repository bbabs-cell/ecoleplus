'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { definirMotDePasseAction } from '@/services/auth.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" className="w-full" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
    </Bouton>
  );
}

export function FormulaireNouveauMotDePasse() {
  const [etat, action] = useActionState(definirMotDePasseAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {etat.statut === 'erreur' && !etat.champs ? (
        <Alerte ton="danger">{etat.message}</Alerte>
      ) : null}

      <Champ
        label="Nouveau mot de passe"
        htmlFor="motDePasse"
        erreur={champs['motDePasse']}
        aide="Au moins douze caractères. Une phrase est plus sûre qu'un mot compliqué."
        obligatoire
      >
        <Saisie
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          erreur={Boolean(champs['motDePasse'])}
        />
      </Champ>

      <Champ
        label="Confirmer le mot de passe"
        htmlFor="confirmation"
        erreur={champs['confirmation']}
        obligatoire
      >
        <Saisie
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          erreur={Boolean(champs['confirmation'])}
        />
      </Champ>

      <BoutonEnvoi />
    </form>
  );
}
