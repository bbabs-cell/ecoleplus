'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { clientServeur } from '@/lib/supabase/server';
import {
  connexionSchema,
  inscriptionSchema,
  motDePasseOublieSchema,
  nouveauMotDePasseSchema,
} from '@/lib/validation';
import { cheminInterne } from '@/lib/navigation';
import { champsInvalides } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

export async function connexionAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const saisie = connexionSchema.safeParse({
    email: donnees.get('email'),
    motDePasse: donnees.get('motDePasse'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  const { error } = await supabase.auth.signInWithPassword({
    email: saisie.data.email,
    password: saisie.data.motDePasse,
  });

  if (error) {
    // Message volontairement identique pour un compte inexistant et un mot de
    // passe erroné : distinguer les deux révélerait quelles adresses existent.
    return { statut: 'erreur', message: 'Identifiants incorrects.' };
  }

  redirect(cheminInterne(donnees.get('suite')));
}

export async function inscriptionAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const saisie = inscriptionSchema.safeParse({
    prenom: donnees.get('prenom'),
    nom: donnees.get('nom'),
    email: donnees.get('email'),
    motDePasse: donnees.get('motDePasse'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  const { data, error } = await supabase.auth.signUp({
    email: saisie.data.email,
    password: saisie.data.motDePasse,
    // Repris par le trigger `handle_new_user` pour créer le profil.
    options: { data: { given_name: saisie.data.prenom, family_name: saisie.data.nom } },
  });

  if (error) {
    return { statut: 'erreur', message: "La création du compte n'a pas abouti." };
  }

  // Sans session, le projet exige une confirmation par e-mail.
  if (!data.session) {
    return {
      statut: 'succes',
      message: 'Compte créé. Confirmez votre adresse e-mail pour vous connecter.',
    };
  }

  redirect('/bienvenue');
}

/**
 * Origine de l'application, telle que le navigateur l'a demandée.
 *
 * L'en-tête `Host` est falsifiable, mais cela ne donne aucune prise : Supabase
 * n'envoie le lien qu'à l'adresse du compte, et refuse toute redirection qui
 * ne figure pas dans sa liste d'URL autorisées. Une origine forgée produit donc
 * un lien rejeté, pas un lien détourné.
 */
async function origineDemandee(): Promise<string> {
  const entetes = await headers();
  const hote = entetes.get('x-forwarded-host') ?? entetes.get('host') ?? '';
  const protocole = entetes.get('x-forwarded-proto') ?? (hote.startsWith('localhost') ? 'http' : 'https');
  return `${protocole}://${hote}`;
}

/**
 * Demande un lien de réinitialisation.
 *
 * La réponse est **la même que l'adresse existe ou non**, pour la raison qui
 * fait dire « Identifiants incorrects » à la connexion : un message distinct
 * transformerait ce formulaire en test d'existence de comptes.
 */
export async function demanderReinitialisationAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const saisie = motDePasseOublieSchema.safeParse({ email: donnees.get('email') });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const origine = await origineDemandee();

  // L'erreur éventuelle n'est pas remontée : elle dirait si l'adresse est
  // connue. Seules les pannes de configuration s'y cachent, et elles se
  // diagnostiquent côté Supabase, pas devant un visiteur non authentifié.
  await supabase.auth.resetPasswordForEmail(saisie.data.email, {
    redirectTo: `${origine}/auth/rappel?suite=/nouveau-mot-de-passe`,
  });

  return {
    statut: 'succes',
    message:
      'Si un compte existe pour cette adresse, un lien de réinitialisation vient d’y être envoyé. ' +
      'Il est valable une heure.',
  };
}

/**
 * Définit un nouveau mot de passe.
 *
 * N'est atteignable qu'avec une session ouverte — celle que le lien de
 * réinitialisation vient d'établir, ou celle d'un utilisateur déjà connecté qui
 * change son mot de passe. Le contrôle ne repose pas sur le fait que la page
 * soit difficile à trouver : `getUser()` revalide le jeton auprès du serveur
 * Auth avant toute écriture.
 */
export async function definirMotDePasseAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const saisie = nouveauMotDePasseSchema.safeParse({
    motDePasse: donnees.get('motDePasse'),
    confirmation: donnees.get('confirmation'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      statut: 'erreur',
      message: 'Ce lien a expiré. Demandez-en un nouveau.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password: saisie.data.motDePasse });

  if (error) {
    return { statut: 'erreur', message: "Le mot de passe n'a pas pu être enregistré." };
  }

  redirect('/tableau-de-bord');
}

export async function deconnexionAction(): Promise<void> {
  const supabase = await clientServeur();
  await supabase.auth.signOut();
  redirect('/connexion');
}
