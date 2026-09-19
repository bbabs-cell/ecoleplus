'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { majOrganisationAction, majReglagesAction } from '@/services/organisation.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { Organization, OrganizationSettings } from '@/lib/types/database';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';

interface Option {
  valeur: string;
  libelle: string;
}

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </Bouton>
  );
}

export function FormulaireFiche({
  organisation,
  lectureSeule,
}: {
  organisation: Organization;
  lectureSeule: boolean;
}) {
  const [etat, action] = useActionState(majOrganisationAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {etat.statut === 'erreur' && !etat.champs ? <Alerte ton="danger">{etat.message}</Alerte> : null}
      {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ label="Nom" htmlFor="nom" erreur={champs['nom']} obligatoire>
          <Saisie
            id="nom"
            name="nom"
            required
            defaultValue={organisation.name}
            disabled={lectureSeule}
            erreur={Boolean(champs['nom'])}
          />
        </Champ>

        <Champ label="Ville" htmlFor="ville" erreur={champs['ville']}>
          <Saisie
            id="ville"
            name="ville"
            defaultValue={organisation.city ?? ''}
            disabled={lectureSeule}
          />
        </Champ>

        <Champ label="Téléphone" htmlFor="telephone" erreur={champs['telephone']}>
          <Saisie
            id="telephone"
            name="telephone"
            type="tel"
            defaultValue={organisation.phone ?? ''}
            disabled={lectureSeule}
          />
        </Champ>

        <Champ label="Adresse e-mail" htmlFor="email" erreur={champs['email']}>
          <Saisie
            id="email"
            name="email"
            type="email"
            defaultValue={organisation.email ?? ''}
            disabled={lectureSeule}
            erreur={Boolean(champs['email'])}
          />
        </Champ>
      </div>

      <Champ label="Adresse" htmlFor="adresse" erreur={champs['adresse']}>
        <Saisie
          id="adresse"
          name="adresse"
          defaultValue={organisation.address ?? ''}
          disabled={lectureSeule}
        />
      </Champ>

      {!lectureSeule ? <BoutonEnvoi /> : null}
    </form>
  );
}

export function FormulaireReglages({
  reglages,
  fuseaux,
  devises,
  langues,
  lectureSeule,
}: {
  reglages: OrganizationSettings;
  fuseaux: Option[];
  devises: Option[];
  langues: Option[];
  lectureSeule: boolean;
}) {
  const [etat, action] = useActionState(majReglagesAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  const jours = [
    { valeur: '1', libelle: 'Lundi' },
    { valeur: '2', libelle: 'Mardi' },
    { valeur: '3', libelle: 'Mercredi' },
    { valeur: '4', libelle: 'Jeudi' },
    { valeur: '5', libelle: 'Vendredi' },
    { valeur: '6', libelle: 'Samedi' },
    { valeur: '7', libelle: 'Dimanche' },
  ];

  return (
    <form action={action} className="space-y-4" noValidate>
      {etat.statut === 'erreur' && !etat.champs ? <Alerte ton="danger">{etat.message}</Alerte> : null}
      {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ label="Langue par défaut" htmlFor="langue" erreur={champs['langue']} obligatoire>
          <Liste id="langue" name="langue" defaultValue={reglages.default_locale} disabled={lectureSeule}>
            {langues.map((option) => (
              <option key={option.valeur} value={option.valeur}>
                {option.libelle}
              </option>
            ))}
          </Liste>
        </Champ>

        <Champ label="Fuseau horaire" htmlFor="fuseau" erreur={champs['fuseau']} obligatoire>
          <Liste id="fuseau" name="fuseau" defaultValue={reglages.timezone} disabled={lectureSeule}>
            {fuseaux.map((option) => (
              <option key={option.valeur} value={option.valeur}>
                {option.libelle}
              </option>
            ))}
          </Liste>
        </Champ>

        <Champ label="Devise" htmlFor="devise" erreur={champs['devise']} obligatoire>
          <Liste id="devise" name="devise" defaultValue={reglages.currency} disabled={lectureSeule}>
            {devises.map((option) => (
              <option key={option.valeur} value={option.valeur}>
                {option.libelle}
              </option>
            ))}
          </Liste>
        </Champ>

        <Champ
          label="Affichage des noms"
          htmlFor="formatNom"
          erreur={champs['formatNom']}
          aide="L'ordre prénom/nom n'est pas universel."
          obligatoire
        >
          <Liste
            id="formatNom"
            name="formatNom"
            defaultValue={reglages.name_display_format}
            disabled={lectureSeule}
          >
            <option value="GIVEN_FAMILY">Prénom Nom</option>
            <option value="FAMILY_GIVEN">Nom Prénom</option>
            <option value="FAMILY_UPPER_GIVEN">NOM Prénom</option>
          </Liste>
        </Champ>

        <Champ label="Format de date" htmlFor="formatDate" erreur={champs['formatDate']} obligatoire>
          <Liste
            id="formatDate"
            name="formatDate"
            defaultValue={reglages.date_format}
            disabled={lectureSeule}
          >
            <option value="DD/MM/YYYY">31/12/2026</option>
            <option value="MM/DD/YYYY">12/31/2026</option>
            <option value="YYYY-MM-DD">2026-12-31</option>
            <option value="DD.MM.YYYY">31.12.2026</option>
          </Liste>
        </Champ>

        <Champ
          label="Premier jour de la semaine"
          htmlFor="debutSemaine"
          erreur={champs['debutSemaine']}
          obligatoire
        >
          <Liste
            id="debutSemaine"
            name="debutSemaine"
            defaultValue={String(reglages.week_starts_on)}
            disabled={lectureSeule}
          >
            {jours.map((jour) => (
              <option key={jour.valeur} value={jour.valeur}>
                {jour.libelle}
              </option>
            ))}
          </Liste>
        </Champ>
      </div>

      {!lectureSeule ? <BoutonEnvoi /> : null}
    </form>
  );
}
