'use server';

import { revalidatePath } from 'next/cache';
import { clientServeur } from '@/lib/supabase/server';
import { exigerOrganisation, exigerPermission } from '@/services/permissions';
import { R2NonConfigure, tailleObjet, urlDeDepot } from '@/lib/r2/client';
import { messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

/**
 * Types acceptés.
 *
 * Liste blanche plutôt que liste noire : tout ce qui n'est pas explicitement
 * prévu est refusé. Un dossier scolaire reçoit des pièces justificatives et des
 * photos, pas des exécutables ni des archives.
 */
const TYPES_ACCEPTES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

const TAILLE_MAXIMALE = 26214400; // 25 Mio, comme la contrainte en base.

interface CibleFichier {
  apprenantId?: string;
  inscriptionId?: string;
  pointageId?: string;
}

/**
 * Prépare un dépôt et rend l'URL signée.
 *
 * Le fichier ne transite PAS par le serveur : il part du navigateur vers R2.
 * Ce qui reste côté serveur, c'est le contrôle — permission, type, taille — et
 * la signature, qui n'est délivrée qu'après.
 */
export async function preparerDepotAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('files.upload');

  const nom = String(donnees.get('nom') ?? '').trim();
  const typeMime = String(donnees.get('typeMime') ?? '').toLowerCase().trim();
  const taille = Number.parseInt(String(donnees.get('taille') ?? ''), 10);
  const categorie = String(donnees.get('categorie') ?? '').trim();

  const cible: CibleFichier = {
    ...(donnees.get('apprenantId') ? { apprenantId: String(donnees.get('apprenantId')) } : {}),
    ...(donnees.get('inscriptionId')
      ? { inscriptionId: String(donnees.get('inscriptionId')) }
      : {}),
    ...(donnees.get('pointageId') ? { pointageId: String(donnees.get('pointageId')) } : {}),
  };

  if (!nom) return { statut: 'erreur', message: 'Nom de fichier manquant.' };

  if (!TYPES_ACCEPTES.has(typeMime)) {
    return {
      statut: 'erreur',
      message: `Type de fichier refusé : ${typeMime || 'inconnu'}. Formats acceptés : PDF, JPEG, PNG, WebP, HEIC.`,
    };
  }

  if (!Number.isSafeInteger(taille) || taille <= 0) {
    return { statut: 'erreur', message: 'Taille de fichier illisible.' };
  }

  if (taille > TAILLE_MAXIMALE) {
    return {
      statut: 'erreur',
      message: `Fichier trop volumineux (${Math.round(taille / 1048576)} Mo). Maximum : 25 Mo.`,
    };
  }

  const supabase = await clientServeur();
  const { data, error } = await supabase
    .rpc('preparer_fichier', {
      p_original_name: nom,
      p_mime_type: typeMime,
      p_size_bytes: taille,
      ...(categorie ? { p_category: categorie } : {}),
      ...(cible.apprenantId ? { p_learner_id: cible.apprenantId } : {}),
      ...(cible.inscriptionId ? { p_enrollment_id: cible.inscriptionId } : {}),
      ...(cible.pointageId ? { p_record_id: cible.pointageId } : {}),
    })
    .maybeSingle();

  if (error) return { statut: 'erreur', message: messageErreur(error) };
  if (!data) return { statut: 'erreur', message: "Le dépôt n'a pas pu être préparé." };

  try {
    return {
      statut: 'succes',
      message: 'Dépôt préparé.',
      donnees: { fichierId: data.fichier_id, url: urlDeDepot(data.cle_stockage, typeMime) },
    };
  } catch (erreur) {
    if (erreur instanceof R2NonConfigure) {
      return { statut: 'erreur', message: erreur.message };
    }
    throw erreur;
  }
}

/**
 * Confirme un dépôt après avoir CONSTATÉ l'objet dans R2.
 *
 * On ne croit pas le navigateur sur parole : c'est la taille rapportée par R2
 * qui décide. Un écart met le fichier en quarantaine plutôt que de le servir
 * (@CLAUDE.md, règle 3).
 */
export async function confirmerDepotAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('files.upload');

  const fichierId = String(donnees.get('fichierId') ?? '');
  const cheminRevalider = String(donnees.get('chemin') ?? '');
  if (!fichierId) return { statut: 'erreur', message: 'Fichier introuvable.' };

  const supabase = await clientServeur();

  const { data: fichier, error: erreurLecture } = await supabase
    .from('files')
    .select('storage_key')
    .eq('id', fichierId)
    .maybeSingle();

  if (erreurLecture) return { statut: 'erreur', message: messageErreur(erreurLecture) };
  if (!fichier) return { statut: 'erreur', message: 'Fichier introuvable.' };

  let taille: number | null;
  try {
    taille = await tailleObjet(fichier.storage_key);
  } catch (erreur) {
    if (erreur instanceof R2NonConfigure) {
      return { statut: 'erreur', message: erreur.message };
    }
    throw erreur;
  }

  if (taille === null) {
    return {
      statut: 'erreur',
      message: "Le fichier n'a pas été trouvé dans le stockage : le dépôt a échoué.",
    };
  }

  const { data, error } = await supabase.rpc('confirmer_fichier', {
    p_file_id: fichierId,
    p_size_constatee: taille,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  if (cheminRevalider) revalidatePath(cheminRevalider);

  if (data === 'QUARANTINED') {
    return {
      statut: 'erreur',
      message:
        'Le fichier déposé ne correspond pas à ce qui était annoncé. Il est mis de côté et ne sera pas servi.',
    };
  }

  return { statut: 'succes', message: 'Document déposé.' };
}

export async function supprimerFichierAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('files.delete');

  const fichierId = String(donnees.get('fichierId') ?? '');
  const raison = String(donnees.get('raison') ?? '').trim();
  const cheminRevalider = String(donnees.get('chemin') ?? '');

  if (!fichierId) return { statut: 'erreur', message: 'Fichier introuvable.' };
  if (!raison) return { statut: 'erreur', message: 'Retirer un document exige un motif.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('supprimer_fichier', {
    p_file_id: fichierId,
    p_raison: raison,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  if (cheminRevalider) revalidatePath(cheminRevalider);
  return {
    statut: 'succes',
    message: 'Document retiré du dossier. La trace demeure au journal.',
  };
}

/** Vérifie que le contexte est bien établi avant d'afficher l'écran documents. */
export async function stockageDisponible(): Promise<boolean> {
  await exigerOrganisation();
  const { stockageConfigure } = await import('@/lib/r2/client');
  return stockageConfigure();
}
