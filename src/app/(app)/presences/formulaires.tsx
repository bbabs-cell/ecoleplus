'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CalendarPlus, X } from 'lucide-react';
import { creerSeanceAction } from '@/services/presences.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { Classe, NameDisplayFormat, Subject, Teacher } from '@/lib/types/database';
import { nomAffiche } from '@/lib/format';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? 'Ouverture…' : "Ouvrir la feuille d'appel"}
    </Bouton>
  );
}

/**
 * Ouverture d'une séance d'appel.
 *
 * Matière, enseignant et horaires restent facultatifs : une journée entière en
 * maternelle et un cours d'une heure à l'université sont la même séance ici.
 * Le type de séance est un texte libre pour la même raison (CLAUDE.md, règle 2).
 */
export function FormulaireSeance({
  anneeId,
  anneeNom,
  classes,
  matieres,
  enseignants,
  format,
  dateDuJour,
}: {
  anneeId: string;
  anneeNom: string;
  classes: Pick<Classe, 'id' | 'name'>[];
  matieres: Pick<Subject, 'id' | 'name'>[];
  enseignants: Teacher[];
  format: NameDisplayFormat;
  dateDuJour: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(creerSeanceAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (classes.length === 0) {
    return (
      <Alerte ton="alerte" titre="Aucune classe">
        Une séance se rattache à une classe. Créez d&apos;abord une classe sur {anneeNom}.
      </Alerte>
    );
  }

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}
        <Bouton onClick={() => setOuvert(true)} className="w-full sm:w-auto">
          <CalendarPlus className="size-4" aria-hidden="true" />
          Faire l&apos;appel
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <TitreCarte>Nouvelle séance · {anneeNom}</TitreCarte>
          <SousTitreCarte>
            Matière, enseignant et horaires sont facultatifs.
          </SousTitreCarte>
        </div>
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
            <Champ label="Classe" htmlFor="classeId" erreur={champs['classeId']} obligatoire>
              <Liste
                id="classeId"
                name="classeId"
                required
                defaultValue=""
                erreur={Boolean(champs['classeId'])}
              >
                <option value="" disabled>
                  Sélectionnez
                </option>
                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id}>
                    {classe.name}
                  </option>
                ))}
              </Liste>
            </Champ>

            <Champ label="Date" htmlFor="date" erreur={champs['date']} obligatoire>
              <Saisie
                id="date"
                name="date"
                type="date"
                required
                defaultValue={dateDuJour}
                erreur={Boolean(champs['date'])}
              />
            </Champ>

            <Champ label="Matière" htmlFor="matiereId" erreur={champs['matiereId']}>
              <Liste id="matiereId" name="matiereId" defaultValue="">
                <option value="">Non précisée</option>
                {matieres.map((matiere) => (
                  <option key={matiere.id} value={matiere.id}>
                    {matiere.name}
                  </option>
                ))}
              </Liste>
            </Champ>

            <Champ label="Enseignant" htmlFor="enseignantId" erreur={champs['enseignantId']}>
              <Liste id="enseignantId" name="enseignantId" defaultValue="">
                <option value="">Non précisé</option>
                {enseignants.map((enseignant) => (
                  <option key={enseignant.id} value={enseignant.id}>
                    {nomAffiche(enseignant, format)}
                  </option>
                ))}
              </Liste>
            </Champ>

            <Champ
              label="Type de séance"
              htmlFor="type"
              erreur={champs['type']}
              aide="Cours, journée, atelier, stage… le vocabulaire est celui de l'établissement."
            >
              <Saisie id="type" name="type" autoComplete="off" placeholder="Cours" />
            </Champ>

            <div className="grid grid-cols-2 gap-4">
              <Champ label="Début" htmlFor="debut" erreur={champs['debut']}>
                <Saisie id="debut" name="debut" type="time" />
              </Champ>
              <Champ label="Fin" htmlFor="fin" erreur={champs['fin']}>
                <Saisie id="fin" name="fin" type="time" erreur={Boolean(champs['fin'])} />
              </Champ>
            </div>
          </div>

          <BoutonEnvoi />
        </form>
      </CorpsCarte>
    </Carte>
  );
}
