'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { COOKIE_LANGUE, estLocaleConnue } from '@/i18n/locales';
import type { EtatFormulaire } from '@/services/formulaire';

/**
 * Choix de langue de l'utilisateur.
 *
 * Écrit un cookie d'un an. Aucune vérification de permission : changer la
 * langue de SON interface ne donne accès à rien, et l'exiger serait du
 * cérémonial sans objet.
 */
export async function definirLangueAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const choix = String(donnees.get('langue') ?? '');

  if (!estLocaleConnue(choix)) {
    return { statut: 'erreur', message: 'Langue inconnue.' };
  }

  const magasin = await cookies();
  magasin.set(COOKIE_LANGUE, choix, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    // Lisible par le navigateur : ce cookie ne porte aucune décision de
    // sécurité, seulement un réglage d'affichage.
    httpOnly: false,
  });

  revalidatePath('/', 'layout');
  return { statut: 'succes', message: 'Langue enregistrée.' };
}
