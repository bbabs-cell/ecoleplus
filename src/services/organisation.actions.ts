'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { clientServeur } from '@/lib/supabase/server';
import { contexteSession } from '@/services/session';
import { exigerPermission } from '@/services/permissions';
import {
  creationOrganisationSchema,
  majOrganisationSchema,
  majReglagesSchema,
} from '@/lib/validation';
import { champsInvalides, messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

export async function creerOrganisationAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await contexteSession();
  if (!contexte) redirect('/connexion');

  const saisie = creationOrganisationSchema.safeParse({
    nom: donnees.get('nom'),
    codePays: donnees.get('codePays'),
    fuseau: donnees.get('fuseau'),
    devise: donnees.get('devise'),
    langue: donnees.get('langue'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  const { error } = await supabase.rpc('creer_organisation', {
    p_nom: saisie.data.nom,
    p_country_code: saisie.data.codePays,
    p_timezone: saisie.data.fuseau,
    p_currency: saisie.data.devise,
    p_default_locale: saisie.data.langue,
  });

  if (error) {
    return { statut: 'erreur', message: messageErreur(error) };
  }

  // Le jeton courant a été émis avant l'existence de l'organisation : il ne
  // porte donc aucun `org_id`, et RLS refuserait tout. Le rafraîchir rejoue le
  // hook et grave le nouveau contexte.
  await supabase.auth.refreshSession();

  redirect('/tableau-de-bord');
}

export async function majOrganisationAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerPermission('organization.update');

  const saisie = majOrganisationSchema.safeParse({
    nom: donnees.get('nom'),
    ville: donnees.get('ville'),
    adresse: donnees.get('adresse'),
    telephone: donnees.get('telephone'),
    email: donnees.get('email'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  const { error } = await supabase
    .from('organizations')
    .update({
      name: saisie.data.nom,
      city: saisie.data.ville || null,
      address: saisie.data.adresse || null,
      phone: saisie.data.telephone || null,
      email: saisie.data.email || null,
    })
    .eq('id', contexte.organisation.id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/organisation');
  return { statut: 'succes', message: 'Organisation mise à jour.' };
}

export async function majReglagesAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerPermission('organization.settings.update');

  const saisie = majReglagesSchema.safeParse({
    langue: donnees.get('langue'),
    fuseau: donnees.get('fuseau'),
    devise: donnees.get('devise'),
    formatNom: donnees.get('formatNom'),
    formatDate: donnees.get('formatDate'),
    debutSemaine: donnees.get('debutSemaine'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  // La langue par défaut doit rester dans les langues supportées : la migration
  // l'impose par contrainte, on l'assure ici pour éviter l'erreur brute.
  const supportees = Array.from(
    new Set([...contexte.reglages.supported_locales, saisie.data.langue]),
  );

  const { error } = await supabase
    .from('organization_settings')
    .update({
      default_locale: saisie.data.langue,
      supported_locales: supportees,
      timezone: saisie.data.fuseau,
      currency: saisie.data.devise,
      name_display_format: saisie.data.formatNom,
      date_format: saisie.data.formatDate,
      week_starts_on: saisie.data.debutSemaine,
    })
    .eq('organization_id', contexte.organisation.id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/organisation');
  return { statut: 'succes', message: 'Paramètres enregistrés.' };
}
