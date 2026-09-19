'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { UserPlus, X } from 'lucide-react';
import { inscrireApprenantAction } from '@/services/apprenants.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { Classe, Level } from '@/lib/types/database';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';
import { Carte, CorpsCarte, EnTeteCarte, TitreCarte } from '@/components/ui/carte';
import { STATUTS_INSCRIPTION_ORDONNES, libelleStatut } from '@/components/academique/statut-inscription';

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? 'Inscription…' : "Inscrire l'apprenant"}
    </Bouton>
  );
}

/**
 * Inscription d'un nouvel apprenant.
 *
 * Un seul formulaire crée le dossier ET l'inscription : c'est la fonction SQL
 * qui les écrit dans la même transaction, pour qu'aucun dossier ne reste
 * orphelin — un dossier sans inscription serait invisible aux rôles de portée
 * établissement.
 */
export function FormulaireInscription({
  anneeId,
  anneeNom,
  niveaux,
  classes,
}: {
  anneeId: string;
  anneeNom: string;
  niveaux: Level[];
  classes: Pick<Classe, 'id' | 'name'>[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(inscrireApprenantAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton onClick={() => setOuvert(true)}>
          <UserPlus className="size-4" aria-hidden="true" />
          Inscrire un apprenant
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte className="flex items-center justify-between gap-4">
        <TitreCarte>Inscrire un apprenant · {anneeNom}</TitreCarte>
        <Bouton variante="discret" taille="petite" onClick={() => setOuvert(false)}>
          <X className="size-4" aria-hidden="true" />
          Annuler
        </Bouton>
      </EnTeteCarte>
      <CorpsCarte>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="anneeId" value={anneeId} />
          {etat.statut === 'erreur' && !etat.champs ? (
            <Alerte ton="danger">{etat.message}</Alerte>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Prénom" htmlFor="prenom" erreur={champs['prenom']}>
              <Saisie id="prenom" name="prenom" autoComplete="off" />
            </Champ>
            <Champ label="Nom" htmlFor="nom" erreur={champs['nom']} obligatoire>
              <Saisie id="nom" name="nom" required erreur={Boolean(champs['nom'])} autoComplete="off" />
            </Champ>
            <Champ label="Date de naissance" htmlFor="dateNaissance" erreur={champs['dateNaissance']}>
              <Saisie id="dateNaissance" name="dateNaissance" type="date" />
            </Champ>
            <Champ
              label="Genre"
              htmlFor="genre"
              erreur={champs['genre']}
              aide="Texte libre : les catégories officielles varient selon les pays."
            >
              <Saisie id="genre" name="genre" autoComplete="off" />
            </Champ>
            <Champ label="Matricule" htmlFor="matricule" erreur={champs['matricule']}>
              <Saisie id="matricule" name="matricule" autoComplete="off" />
            </Champ>
            <Champ label="Téléphone" htmlFor="telephone" erreur={champs['telephone']}>
              <Saisie id="telephone" name="telephone" type="tel" />
            </Champ>
            <Champ label="Adresse e-mail" htmlFor="email" erreur={champs['email']}>
              <Saisie id="email" name="email" type="email" erreur={Boolean(champs['email'])} />
            </Champ>
            <div />
            <Champ label="Niveau" htmlFor="niveauId" erreur={champs['niveauId']}>
              <Liste id="niveauId" name="niveauId" defaultValue="">
                <option value="">Non précisé</option>
                {niveaux.map((niveau) => (
                  <option key={niveau.id} value={niveau.id}>
                    {niveau.name}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ label="Classe" htmlFor="classeId" erreur={champs['classeId']}>
              <Liste id="classeId" name="classeId" defaultValue="">
                <option value="">Non affecté</option>
                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id}>
                    {classe.name}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ label="Statut" htmlFor="statut" erreur={champs['statut']} obligatoire>
              <Liste id="statut" name="statut" defaultValue="PREREGISTERED">
                {STATUTS_INSCRIPTION_ORDONNES.map((statut) => (
                  <option key={statut} value={statut}>
                    {libelleStatut(statut)}
                  </option>
                ))}
              </Liste>
            </Champ>
          </div>

          <BoutonEnvoi />
        </form>
      </CorpsCarte>
    </Carte>
  );
}

export function RechercheApprenant({ valeur }: { valeur: string }) {
  return (
    <form className="flex-1 sm:max-w-xs">
      <label htmlFor="recherche" className="sr-only">
        Rechercher un apprenant
      </label>
      <Saisie
        id="recherche"
        name="q"
        type="search"
        defaultValue={valeur}
        placeholder="Rechercher par nom…"
      />
    </form>
  );
}
