'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { creerOrganisationAction } from '@/services/organisation.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';

export interface Option {
  valeur: string;
  libelle: string;
}

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" className="w-full" disabled={pending}>
      {pending ? 'Création…' : "Créer l'organisation"}
    </Bouton>
  );
}

export function FormulaireOrganisation({
  pays,
  fuseaux,
  devises,
  langues,
  defauts,
}: {
  pays: Option[];
  fuseaux: Option[];
  devises: Option[];
  langues: Option[];
  defauts: { fuseau: string; langue: string };
}) {
  const [etat, action] = useActionState(creerOrganisationAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {etat.statut === 'erreur' && !etat.champs ? (
        <Alerte ton="danger">{etat.message}</Alerte>
      ) : null}

      <Champ label="Nom de l'organisation" htmlFor="nom" erreur={champs['nom']} obligatoire>
        <Saisie
          id="nom"
          name="nom"
          required
          placeholder="Groupe scolaire Les Palmiers"
          erreur={Boolean(champs['nom'])}
        />
      </Champ>

      <Champ label="Pays" htmlFor="codePays" erreur={champs['codePays']} obligatoire>
        <Liste id="codePays" name="codePays" required defaultValue="" erreur={Boolean(champs['codePays'])}>
          <option value="" disabled>
            Sélectionnez un pays
          </option>
          {pays.map((option) => (
            <option key={option.valeur} value={option.valeur}>
              {option.libelle}
            </option>
          ))}
        </Liste>
      </Champ>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ label="Fuseau horaire" htmlFor="fuseau" erreur={champs['fuseau']} obligatoire>
          <Liste id="fuseau" name="fuseau" required defaultValue={defauts.fuseau}>
            {fuseaux.map((option) => (
              <option key={option.valeur} value={option.valeur}>
                {option.libelle}
              </option>
            ))}
          </Liste>
        </Champ>

        <Champ label="Devise" htmlFor="devise" erreur={champs['devise']} obligatoire>
          <Liste id="devise" name="devise" required defaultValue="EUR">
            {devises.map((option) => (
              <option key={option.valeur} value={option.valeur}>
                {option.libelle}
              </option>
            ))}
          </Liste>
        </Champ>
      </div>

      <Champ
        label="Langue par défaut"
        htmlFor="langue"
        erreur={champs['langue']}
        aide="Modifiable à tout moment dans les paramètres."
        obligatoire
      >
        <Liste id="langue" name="langue" required defaultValue={defauts.langue}>
          {langues.map((option) => (
            <option key={option.valeur} value={option.valeur}>
              {option.libelle}
            </option>
          ))}
        </Liste>
      </Champ>

      <BoutonEnvoi />
    </form>
  );
}
