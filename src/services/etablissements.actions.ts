'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { clientServeur } from '@/lib/supabase/server';
import { exigerOrganisation, exigerPermission } from '@/services/permissions';
import { COOKIE_ETABLISSEMENT } from '@/services/session';
import { etablissementSchema } from '@/lib/validation';
import { champsInvalides, messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

function lireSaisie(donnees: FormData) {
  return etablissementSchema.safeParse({
    nom: donnees.get('nom'),
    code: donnees.get('code'),
    type: donnees.get('type'),
    ville: donnees.get('ville'),
    telephone: donnees.get('telephone'),
    email: donnees.get('email'),
  });
}

export async function creerEtablissementAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerPermission('establishments.create');
  const saisie = lireSaisie(donnees);

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  const { error } = await supabase.from('establishments').insert({
    organization_id: contexte.organisation.id,
    name: saisie.data.nom,
    code: saisie.data.code,
    kind_label: saisie.data.type || null,
    city: saisie.data.ville || null,
    phone: saisie.data.telephone || null,
    email: saisie.data.email || null,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/etablissements');
  return { statut: 'succes', message: `Établissement « ${saisie.data.nom} » créé.` };
}

export async function modifierEtablissementAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('establishments.update');

  const id = String(donnees.get('id') ?? '');
  if (!id) return { statut: 'erreur', message: 'Établissement introuvable.' };

  const saisie = lireSaisie(donnees);
  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  // Pas de filtre sur l'organisation : la policy UPDATE le fait, et un
  // identifiant d'un autre tenant ne touchera simplement aucune ligne.
  const { error, count } = await supabase
    .from('establishments')
    .update(
      {
        name: saisie.data.nom,
        code: saisie.data.code,
        kind_label: saisie.data.type || null,
        city: saisie.data.ville || null,
        phone: saisie.data.telephone || null,
        email: saisie.data.email || null,
      },
      { count: 'exact' },
    )
    .eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };
  if (count === 0) {
    return { statut: 'erreur', message: "Cet établissement n'existe pas ou ne vous est pas accessible." };
  }

  revalidatePath('/etablissements');
  return { statut: 'succes', message: 'Établissement mis à jour.' };
}

/**
 * Archive un établissement.
 *
 * Jamais de suppression : les inscriptions, notes et paiements qui s'y
 * rattacheront doivent rester consultables (CLAUDE.md, règle 5).
 */
export async function archiverEtablissementAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('establishments.update');

  const id = String(donnees.get('id') ?? '');
  const archiver = donnees.get('archiver') === '1';
  if (!id) return { statut: 'erreur', message: 'Établissement introuvable.' };

  const supabase = await clientServeur();

  const { error, count } = await supabase
    .from('establishments')
    .update({ status: archiver ? 'ARCHIVED' : 'ACTIVE' }, { count: 'exact' })
    .eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };
  if (count === 0) {
    return { statut: 'erreur', message: "Cet établissement n'existe pas ou ne vous est pas accessible." };
  }

  revalidatePath('/etablissements');
  return {
    statut: 'succes',
    message: archiver ? 'Établissement archivé.' : 'Établissement réactivé.',
  };
}

/**
 * Change l'établissement de travail courant.
 *
 * Le choix n'est retenu qu'après vérification serveur qu'il figure bien parmi
 * les établissements accessibles : le cookie n'ouvre aucun droit, il exprime
 * une préférence parmi des accès déjà acquis (architecture : « contexte
 * d'établissement actif, changé côté serveur uniquement »).
 */
export async function choisirEtablissementActifAction(donnees: FormData): Promise<void> {
  const contexte = await exigerOrganisation();
  const id = String(donnees.get('etablissementId') ?? '');

  const autorise = contexte.etablissements.some((etablissement) => etablissement.id === id);
  if (!autorise) return;

  const magasin = await cookies();
  magasin.set(COOKIE_ETABLISSEMENT, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/', 'layout');
}
