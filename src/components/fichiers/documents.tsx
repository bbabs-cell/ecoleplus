'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import {
  confirmerDepotAction,
  preparerDepotAction,
  supprimerFichierAction,
} from '@/services/fichiers.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { FichierDetaille } from '@/services/fichiers';
import { tailleLisible } from '@/lib/fichiers';
import { nomAffiche } from '@/lib/format';
import type { NameDisplayFormat, OrganizationSettings } from '@/lib/types/database';
import { formaterDateHeure } from '@/lib/format';
import { Bouton } from '@/components/ui/bouton';
import { Alerte } from '@/components/ui/alerte';
import { Champ, Saisie } from '@/components/ui/champ';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';

const TYPES_ACCEPTES = '.pdf,.jpg,.jpeg,.png,.webp,.heic';

type Reglages = Pick<OrganizationSettings, 'timezone' | 'date_format' | 'default_locale'>;

/**
 * Dépôt d'un document.
 *
 * Le fichier va du navigateur DIRECTEMENT vers R2 : il ne traverse pas le
 * serveur. Trois temps, dont le troisième est le seul qui compte :
 *
 *   1. le serveur vérifie les droits, le type et la taille, puis signe ;
 *   2. le navigateur téléverse ;
 *   3. le serveur va CONSTATER l'objet dans R2 avant de le déclarer déposé.
 *
 * Sans le troisième temps, il suffirait de ne jamais téléverser pour qu'un
 * document apparaisse au dossier (@CLAUDE.md, règle 3).
 */
export function DeposerDocument({
  cible,
  chemin,
  categorieSuggeree,
}: {
  cible: { apprenantId?: string; inscriptionId?: string; pointageId?: string };
  chemin: string;
  categorieSuggeree?: string;
}) {
  const [message, setMessage] = useState<{ ton: 'danger' | 'succes'; texte: string } | null>(null);
  const [etape, setEtape] = useState<'repos' | 'preparation' | 'envoi' | 'confirmation'>('repos');
  const [enTransition, demarrer] = useTransition();
  const champFichier = useRef<HTMLInputElement>(null);
  const champCategorie = useRef<HTMLInputElement>(null);

  const deposer = () => {
    const fichier = champFichier.current?.files?.[0];
    if (!fichier) {
      setMessage({ ton: 'danger', texte: 'Choisissez un fichier.' });
      return;
    }

    setMessage(null);

    demarrer(async () => {
      setEtape('preparation');

      const preparation = new FormData();
      preparation.set('nom', fichier.name);
      preparation.set('typeMime', fichier.type);
      preparation.set('taille', String(fichier.size));
      preparation.set('categorie', champCategorie.current?.value ?? '');
      if (cible.apprenantId) preparation.set('apprenantId', cible.apprenantId);
      if (cible.inscriptionId) preparation.set('inscriptionId', cible.inscriptionId);
      if (cible.pointageId) preparation.set('pointageId', cible.pointageId);

      const prepare = await preparerDepotAction(ETAT_INITIAL, preparation);
      if (prepare.statut !== 'succes' || !prepare.donnees) {
        setEtape('repos');
        setMessage({
          ton: 'danger',
          texte: prepare.statut === 'erreur' ? prepare.message : 'Dépôt impossible.',
        });
        return;
      }

      setEtape('envoi');
      try {
        const envoi = await fetch(prepare.donnees['url'] ?? '', {
          method: 'PUT',
          body: fichier,
          headers: { 'Content-Type': fichier.type },
        });
        if (!envoi.ok) {
          setEtape('repos');
          setMessage({ ton: 'danger', texte: "Le téléversement a échoué. Réessayez." });
          return;
        }
      } catch {
        setEtape('repos');
        setMessage({
          ton: 'danger',
          texte: 'Le téléversement a échoué — connexion interrompue.',
        });
        return;
      }

      setEtape('confirmation');
      const confirmation = new FormData();
      confirmation.set('fichierId', prepare.donnees['fichierId'] ?? '');
      confirmation.set('chemin', chemin);

      const confirme = await confirmerDepotAction(ETAT_INITIAL, confirmation);
      setEtape('repos');

      if (confirme.statut === 'succes') {
        setMessage({ ton: 'succes', texte: confirme.message });
        if (champFichier.current) champFichier.current.value = '';
      } else if (confirme.statut === 'erreur') {
        setMessage({ ton: 'danger', texte: confirme.message });
      }
    });
  };

  const libelleEtape = {
    repos: 'Déposer',
    preparation: 'Préparation…',
    envoi: 'Envoi…',
    confirmation: 'Vérification…',
  }[etape];

  return (
    <div className="space-y-3">
      {message ? <Alerte ton={message.ton}>{message.texte}</Alerte> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Champ label="Document" htmlFor="fichier" aide="PDF ou image, 25 Mo maximum.">
          <input
            ref={champFichier}
            id="fichier"
            type="file"
            accept={TYPES_ACCEPTES}
            className="w-full rounded-douce border border-bordure bg-carte px-3 py-2 text-sm text-encre file:me-3 file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:text-encre"
          />
        </Champ>

        <Champ label="Nature de la pièce" htmlFor="categorie">
          <Saisie
            ref={champCategorie}
            id="categorie"
            defaultValue={categorieSuggeree ?? ''}
            placeholder="Acte de naissance"
            autoComplete="off"
          />
        </Champ>

        <Bouton onClick={deposer} disabled={enTransition} className="min-h-11">
          <Upload className="size-4" aria-hidden="true" />
          {libelleEtape}
        </Bouton>
      </div>
    </div>
  );
}

function SupprimerDocument({ fichierId, chemin }: { fichierId: string; chemin: string }) {
  const [etat, action] = useActionState(supprimerFichierAction, ETAT_INITIAL);
  const [ouvert, setOuvert] = useState(false);

  if (!ouvert) {
    return (
      <Bouton
        variante="discret"
        taille="petite"
        onClick={() => setOuvert(true)}
        aria-label="Retirer ce document"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </Bouton>
    );
  }

  return (
    <form action={action} className="flex w-full flex-wrap items-end gap-2">
      <input type="hidden" name="fichierId" value={fichierId} />
      <input type="hidden" name="chemin" value={chemin} />
      {etat.statut === 'erreur' ? (
        <span className="w-full text-xs font-medium text-danger">{etat.message}</span>
      ) : null}
      <Champ label="Motif du retrait" htmlFor={`raison-${fichierId}`} obligatoire>
        <Saisie
          id={`raison-${fichierId}`}
          name="raison"
          required
          placeholder="Pièce déposée sur le mauvais dossier"
          className="min-w-64"
        />
      </Champ>
      <Bouton variante="danger" taille="petite" type="submit">
        Retirer
      </Bouton>
      <Bouton variante="discret" taille="petite" type="button" onClick={() => setOuvert(false)}>
        Annuler
      </Bouton>
    </form>
  );
}

/**
 * Liste des documents.
 *
 * Chaque lien passe par `/api/fichiers/[id]`, qui vérifie les droits puis
 * redirige vers une URL signée d'une minute. Aucune URL de stockage
 * n'apparaît dans cette page.
 */
export function ListeDocuments({
  fichiers,
  chemin,
  reglages,
  format,
  peutSupprimer,
}: {
  fichiers: FichierDetaille[];
  chemin: string;
  reglages: Reglages;
  format: NameDisplayFormat;
  peutSupprimer: boolean;
}) {
  if (fichiers.length === 0) {
    return (
      <p className="text-sm text-encre-douce">
        Aucun document. Les pièces déposées ici sont privées : elles ne sont accessibles
        qu&apos;aux personnes ayant le droit de lire ce dossier.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {fichiers.map((fichier) => (
        <li
          key={fichier.id}
          className="flex flex-wrap items-center gap-3 rounded-douce border border-bordure px-3 py-2"
        >
          <FileText className="size-4 shrink-0 text-encre-douce" aria-hidden="true" />

          <div className="min-w-0 flex-1">
            <a
              href={`/api/fichiers/${fichier.id}`}
              className="font-medium text-primaire hover:underline"
              // Le document part en téléchargement, pas en navigation : l'URL
              // signée ne doit pas rester dans la barre d'adresse.
              rel="nofollow"
            >
              {fichier.original_name}
            </a>
            <p className="text-xs text-encre-douce">
              {[
                fichier.category_label,
                tailleLisible(fichier.size_bytes),
                fichier.deposePar
                  ? `déposé par ${nomAffiche(fichier.deposePar, format)}`
                  : null,
                fichier.uploaded_at ? formaterDateHeure(fichier.uploaded_at, reglages) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          {peutSupprimer ? <SupprimerDocument fichierId={fichier.id} chemin={chemin} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function CarteDocuments({
  titre,
  fichiers,
  chemin,
  reglages,
  format,
  cible,
  peutDeposer,
  peutSupprimer,
  stockageActif,
  categorieSuggeree,
}: {
  titre: string;
  fichiers: FichierDetaille[];
  chemin: string;
  reglages: Reglages;
  format: NameDisplayFormat;
  cible: { apprenantId?: string; inscriptionId?: string; pointageId?: string };
  peutDeposer: boolean;
  peutSupprimer: boolean;
  stockageActif: boolean;
  categorieSuggeree?: string;
}) {
  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte className="flex items-center gap-2">
          <Paperclip className="size-4" aria-hidden="true" />
          {titre}
        </TitreCarte>
        <SousTitreCarte>
          Documents privés. Chaque téléchargement passe par une vérification de droits et une
          URL valable une minute — aucune pièce n&apos;est accessible par la seule connaissance
          de son adresse.
        </SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte className="space-y-4">
        {!stockageActif ? (
          <Alerte ton="alerte" titre="Stockage de documents non configuré">
            Les variables <code>R2_ACCOUNT_ID</code>, <code>R2_ACCESS_KEY_ID</code>,{' '}
            <code>R2_SECRET_ACCESS_KEY</code> et <code>R2_BUCKET</code> doivent être renseignées
            (voir <code>.env.example</code>) pour activer le dépôt de documents. Les pièces déjà
            enregistrées restent listées.
          </Alerte>
        ) : peutDeposer ? (
          <DeposerDocument
            cible={cible}
            chemin={chemin}
            {...(categorieSuggeree ? { categorieSuggeree } : {})}
          />
        ) : null}

        <ListeDocuments
          fichiers={fichiers}
          chemin={chemin}
          reglages={reglages}
          format={format}
          peutSupprimer={peutSupprimer}
        />
      </CorpsCarte>
    </Carte>
  );
}
