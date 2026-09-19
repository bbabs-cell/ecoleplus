'use server';

import { redirect } from 'next/navigation';
import { clientServeur } from '@/lib/supabase/server';
import { connexionSchema, inscriptionSchema } from '@/lib/validation';
import { champsInvalides } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

/** N'accepte qu'un chemin interne : sinon la redirection devient un tremplin. */
function destinationSure(valeur: FormDataEntryValue | null): string {
  const brut = typeof valeur === 'string' ? valeur : '';
  return brut.startsWith('/') && !brut.startsWith('//') ? brut : '/tableau-de-bord';
}

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

  redirect(destinationSure(donnees.get('suite')));
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

export async function deconnexionAction(): Promise<void> {
  const supabase = await clientServeur();
  await supabase.auth.signOut();
  redirect('/connexion');
}
