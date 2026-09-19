'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Pencil, UserPlus } from 'lucide-react';
import {
  affecterClasseAction,
  changerStatutInscriptionAction,
  modifierApprenantAction,
  reinscrireApprenantAction,
} from '@/services/apprenants.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { AcademicYear, Classe, EnrollmentStatus, Learner, Level } from '@/lib/types/database';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { STATUTS_INSCRIPTION_ORDONNES, libelleStatut } from '@/components/academique/statut-inscription';

function BoutonEnvoi({ libelle, enCours }: { libelle: string; enCours: string }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? enCours : libelle}
    </Bouton>
  );
}

export function FicheApprenant({
  apprenant,
  peutModifier,
}: {
  apprenant: Learner;
  peutModifier: boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [etat, action] = useActionState(modifierApprenantAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (!edition) {
    const lignes: [string, string | null][] = [
      ['Date de naissance', apprenant.birth_date],
      ['Lieu de naissance', apprenant.birth_place],
      ['Genre', apprenant.gender_label],
      ['Nationalité', apprenant.nationality],
      ['Matricule', apprenant.learner_code],
      ['Adresse e-mail', apprenant.email],
      ['Téléphone', apprenant.phone],
      ['Adresse', apprenant.address],
    ];

    return (
      <Carte>
        <EnTeteCarte className="flex items-center justify-between gap-4">
          <TitreCarte>Dossier</TitreCarte>
          {peutModifier ? (
            <Bouton variante="secondaire" taille="petite" onClick={() => setEdition(true)}>
              <Pencil className="size-3.5" aria-hidden="true" />
              Modifier
            </Bouton>
          ) : null}
        </EnTeteCarte>
        <CorpsCarte>
          {etat.statut === 'succes' ? (
            <Alerte ton="succes" className="mb-4">
              {etat.message}
            </Alerte>
          ) : null}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {lignes.map(([libelle, valeur]) => (
              <div key={libelle}>
                <dt className="text-xs text-encre-douce">{libelle}</dt>
                <dd className="text-sm text-encre">{valeur || '—'}</dd>
              </div>
            ))}
          </dl>
        </CorpsCarte>
      </Carte>
    );
  }

  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte>Modifier le dossier</TitreCarte>
      </EnTeteCarte>
      <CorpsCarte>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={apprenant.id} />
          {etat.statut === 'erreur' && !etat.champs ? (
            <Alerte ton="danger">{etat.message}</Alerte>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Prénom" htmlFor="prenom" erreur={champs['prenom']}>
              <Saisie id="prenom" name="prenom" defaultValue={apprenant.given_name} />
            </Champ>
            <Champ label="Nom" htmlFor="nom" erreur={champs['nom']} obligatoire>
              <Saisie id="nom" name="nom" required defaultValue={apprenant.family_name} erreur={Boolean(champs['nom'])} />
            </Champ>
            <Champ label="Date de naissance" htmlFor="dateNaissance" erreur={champs['dateNaissance']}>
              <Saisie id="dateNaissance" name="dateNaissance" type="date" defaultValue={apprenant.birth_date ?? ''} />
            </Champ>
            <Champ label="Lieu de naissance" htmlFor="lieuNaissance" erreur={champs['lieuNaissance']}>
              <Saisie id="lieuNaissance" name="lieuNaissance" defaultValue={apprenant.birth_place ?? ''} />
            </Champ>
            <Champ label="Genre" htmlFor="genre" erreur={champs['genre']}>
              <Saisie id="genre" name="genre" defaultValue={apprenant.gender_label ?? ''} />
            </Champ>
            <Champ label="Nationalité" htmlFor="nationalite" erreur={champs['nationalite']}>
              <Saisie id="nationalite" name="nationalite" defaultValue={apprenant.nationality ?? ''} />
            </Champ>
            <Champ label="Matricule" htmlFor="matricule" erreur={champs['matricule']}>
              <Saisie id="matricule" name="matricule" defaultValue={apprenant.learner_code ?? ''} />
            </Champ>
            <Champ label="Téléphone" htmlFor="telephone" erreur={champs['telephone']}>
              <Saisie id="telephone" name="telephone" type="tel" defaultValue={apprenant.phone ?? ''} />
            </Champ>
            <Champ label="Adresse e-mail" htmlFor="email" erreur={champs['email']}>
              <Saisie id="email" name="email" type="email" defaultValue={apprenant.email ?? ''} erreur={Boolean(champs['email'])} />
            </Champ>
            <Champ label="Adresse" htmlFor="adresse" erreur={champs['adresse']}>
              <Saisie id="adresse" name="adresse" defaultValue={apprenant.address ?? ''} />
            </Champ>
          </div>

          <div className="flex gap-2">
            <BoutonEnvoi libelle="Enregistrer" enCours="Enregistrement…" />
            <Bouton variante="secondaire" type="button" onClick={() => setEdition(false)}>
              Annuler
            </Bouton>
          </div>
        </form>
      </CorpsCarte>
    </Carte>
  );
}

export function ActionsInscription({
  inscriptionId,
  statutActuel,
  classeActuelle,
  classes,
  peutGerer,
}: {
  inscriptionId: string;
  statutActuel: EnrollmentStatus;
  classeActuelle: string | null;
  classes: Pick<Classe, 'id' | 'name'>[];
  peutGerer: boolean;
}) {
  const [etatStatut, actionStatut] = useActionState(changerStatutInscriptionAction, ETAT_INITIAL);
  const [etatClasse, actionClasse] = useActionState(affecterClasseAction, ETAT_INITIAL);

  if (!peutGerer) return null;

  const erreur =
    etatStatut.statut === 'erreur'
      ? etatStatut.message
      : etatClasse.statut === 'erreur'
        ? etatClasse.message
        : null;

  return (
    <div className="space-y-2 border-t border-bordure pt-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form action={actionStatut} className="space-y-2">
          <input type="hidden" name="inscriptionId" value={inscriptionId} />
          <Champ label="Statut" htmlFor={`statut-${inscriptionId}`}>
            <Liste
              id={`statut-${inscriptionId}`}
              name="statut"
              defaultValue={statutActuel}
              className="h-9"
            >
              {STATUTS_INSCRIPTION_ORDONNES.map((statut) => (
                <option key={statut} value={statut}>
                  {libelleStatut(statut)}
                </option>
              ))}
            </Liste>
          </Champ>
          <Champ label="Motif" htmlFor={`raison-${inscriptionId}`} aide="Conservé dans le journal d'audit.">
            <Saisie id={`raison-${inscriptionId}`} name="raison" placeholder="Facultatif" />
          </Champ>
          <Bouton variante="secondaire" taille="petite" type="submit">
            Changer le statut
          </Bouton>
        </form>

        <form action={actionClasse} className="space-y-2">
          <input type="hidden" name="inscriptionId" value={inscriptionId} />
          <Champ label="Classe" htmlFor={`classe-${inscriptionId}`}>
            <Liste
              id={`classe-${inscriptionId}`}
              name="classeId"
              defaultValue={classeActuelle ?? ''}
              className="h-9"
            >
              <option value="">Sans classe</option>
              {classes.map((classe) => (
                <option key={classe.id} value={classe.id}>
                  {classe.name}
                </option>
              ))}
            </Liste>
          </Champ>
          <Bouton variante="secondaire" taille="petite" type="submit">
            Affecter
          </Bouton>
        </form>
      </div>

      {erreur ? <p className="text-xs font-medium text-danger">{erreur}</p> : null}
    </div>
  );
}

export function FormulaireReinscription({
  apprenantId,
  annees,
  niveaux,
  classesParAnnee,
}: {
  apprenantId: string;
  annees: AcademicYear[];
  niveaux: Level[];
  classesParAnnee: Record<string, Pick<Classe, 'id' | 'name'>[]>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(reinscrireApprenantAction, ETAT_INITIAL);
  const [anneeChoisie, setAnneeChoisie] = useState(annees[0]?.id ?? '');

  if (annees.length === 0) return null;

  const classes = classesParAnnee[anneeChoisie] ?? [];

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton variante="secondaire" onClick={() => setOuvert(true)}>
          <UserPlus className="size-4" aria-hidden="true" />
          Réinscrire
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte>Réinscrire</TitreCarte>
        <SousTitreCarte>
          Nouvelle année, ou transfert vers l&apos;établissement de travail courant. Le dossier,
          lui, reste le même.
        </SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="apprenantId" value={apprenantId} />
          {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Champ label="Année" htmlFor="reinscription-annee" obligatoire>
              <Liste
                id="reinscription-annee"
                name="anneeId"
                required
                value={anneeChoisie}
                onChange={(evenement) => setAnneeChoisie(evenement.target.value)}
              >
                {annees.map((annee) => (
                  <option key={annee.id} value={annee.id}>
                    {annee.name}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ label="Niveau" htmlFor="reinscription-niveau">
              <Liste id="reinscription-niveau" name="niveauId" defaultValue="">
                <option value="">Non précisé</option>
                {niveaux.map((niveau) => (
                  <option key={niveau.id} value={niveau.id}>
                    {niveau.name}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ label="Classe" htmlFor="reinscription-classe">
              <Liste id="reinscription-classe" name="classeId" defaultValue="">
                <option value="">Non affecté</option>
                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id}>
                    {classe.name}
                  </option>
                ))}
              </Liste>
            </Champ>
          </div>

          <div className="flex gap-2">
            <BoutonEnvoi libelle="Réinscrire" enCours="Enregistrement…" />
            <Bouton variante="secondaire" type="button" onClick={() => setOuvert(false)}>
              Annuler
            </Bouton>
          </div>
        </form>
      </CorpsCarte>
    </Carte>
  );
}
