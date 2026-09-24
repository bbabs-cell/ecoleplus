'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { FilePlus2, X } from 'lucide-react';
import { creerEvaluationAction } from '@/services/notation.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type {
  AcademicTerm,
  Classe,
  GradingCategory,
  GradingSystem,
  NameDisplayFormat,
  Subject,
  Teacher,
} from '@/lib/types/database';
import { nomAffiche } from '@/lib/format';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? 'Création…' : "Créer l'évaluation"}
    </Bouton>
  );
}

/**
 * Création d'une évaluation.
 *
 * Le champ décisif est la politique de note manquante : il n'a pas de valeur
 * silencieuse. Le défaut proposé est « ignorer », et compter une absence comme
 * un zéro reste un choix que quelqu'un doit poser (@CLAUDE.md, règle 4).
 */
export function FormulaireEvaluation({
  anneeId,
  anneeNom,
  classes,
  matieres,
  baremes,
  categories,
  periodes,
  enseignants,
  format,
  dateDuJour,
}: {
  anneeId: string;
  anneeNom: string;
  classes: Pick<Classe, 'id' | 'name'>[];
  matieres: Pick<Subject, 'id' | 'name'>[];
  baremes: GradingSystem[];
  categories: GradingCategory[];
  periodes: AcademicTerm[];
  enseignants: Teacher[];
  format: NameDisplayFormat;
  dateDuJour: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(creerEvaluationAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (classes.length === 0 || matieres.length === 0 || baremes.length === 0) {
    return (
      <Alerte ton="alerte" titre="Référentiel incomplet">
        Une évaluation exige une classe, une matière et un barème. Complétez le référentiel de
        l&apos;établissement avant de noter.
      </Alerte>
    );
  }

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}
        <Bouton onClick={() => setOuvert(true)} className="w-full sm:w-auto">
          <FilePlus2 className="size-4" aria-hidden="true" />
          Nouvelle évaluation
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <TitreCarte>Nouvelle évaluation · {anneeNom}</TitreCarte>
          <SousTitreCarte>
            Le barème, le coefficient et la politique de note manquante se figent à la publication.
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
            <Champ label="Titre" htmlFor="titre" erreur={champs['titre']} obligatoire>
              <Saisie
                id="titre"
                name="titre"
                required
                autoComplete="off"
                placeholder="Devoir surveillé n° 1"
                erreur={Boolean(champs['titre'])}
              />
            </Champ>

            <Champ label="Date" htmlFor="date" erreur={champs['date']} obligatoire>
              <Saisie id="date" name="date" type="date" required defaultValue={dateDuJour} />
            </Champ>

            <Champ label="Classe" htmlFor="classeId" erreur={champs['classeId']} obligatoire>
              <Liste id="classeId" name="classeId" required defaultValue="">
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

            <Champ label="Matière" htmlFor="matiereId" erreur={champs['matiereId']} obligatoire>
              <Liste id="matiereId" name="matiereId" required defaultValue="">
                <option value="" disabled>
                  Sélectionnez
                </option>
                {matieres.map((matiere) => (
                  <option key={matiere.id} value={matiere.id}>
                    {matiere.name}
                  </option>
                ))}
              </Liste>
            </Champ>

            <Champ
              label="Barème"
              htmlFor="baremeId"
              erreur={champs['baremeId']}
              aide="Sur 20, sur 100, lettres, niveaux de maîtrise — au choix de l'établissement."
              obligatoire
            >
              <Liste id="baremeId" name="baremeId" required defaultValue="">
                <option value="" disabled>
                  Sélectionnez
                </option>
                {baremes.map((bareme) => (
                  <option key={bareme.id} value={bareme.id}>
                    {bareme.name} ({bareme.min_value}–{bareme.max_value})
                  </option>
                ))}
              </Liste>
            </Champ>

            <Champ
              label="Coefficient"
              htmlFor="coefficient"
              erreur={champs['coefficient']}
              obligatoire
            >
              <Saisie
                id="coefficient"
                name="coefficient"
                type="number"
                step="0.25"
                min="0.25"
                defaultValue="1"
                required
                erreur={Boolean(champs['coefficient'])}
              />
            </Champ>

            <Champ label="Période" htmlFor="periodeId" erreur={champs['periodeId']}>
              <Liste id="periodeId" name="periodeId" defaultValue="">
                <option value="">Hors période</option>
                {periodes.map((periode) => (
                  <option key={periode.id} value={periode.id}>
                    {periode.name}
                  </option>
                ))}
              </Liste>
            </Champ>

            <Champ
              label="Catégorie"
              htmlFor="categorieId"
              erreur={champs['categorieId']}
              aide="Contrôle continu, examen… chaque catégorie porte son poids."
            >
              <Liste id="categorieId" name="categorieId" defaultValue="">
                <option value="">Aucune</option>
                {categories.map((categorie) => (
                  <option key={categorie.id} value={categorie.id}>
                    {categorie.name} (poids {categorie.weight})
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
              label="Note manquante"
              htmlFor="politiqueNoteManquante"
              erreur={champs['politiqueNoteManquante']}
              aide="Ce que devient une absence dans la moyenne. Rien n'est décidé à votre place."
              obligatoire
            >
              <Liste
                id="politiqueNoteManquante"
                name="politiqueNoteManquante"
                required
                defaultValue="SKIP"
              >
                <option value="SKIP">Ignorée — la moyenne porte sur les notes présentes</option>
                <option value="ZERO">Comptée comme zéro</option>
                <option value="EXCLUDED">L&apos;évaluation ne concerne pas l&apos;apprenant</option>
              </Liste>
            </Champ>
          </div>

          <BoutonEnvoi />
        </form>
      </CorpsCarte>
    </Carte>
  );
}
