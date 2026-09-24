import 'server-only';
import { cookies } from 'next/headers';
import { traduire } from '@/i18n/dictionnaires';
import { COOKIE_LANGUE, LOCALE_PAR_DEFAUT, type Locale, normaliserLocale } from '@/i18n/locales';

/**
 * Langue active, côté serveur.
 *
 * Elle vient d'un cookie que le proxy recopie depuis le claim `locale` du
 * jeton — donc depuis les réglages de l'organisation. Un utilisateur peut
 * ensuite la changer pour lui-même, et son choix prime.
 *
 * Ce cookie ne porte AUCUNE décision de sécurité : le falsifier ne change que
 * la langue d'affichage. C'est pourquoi il peut rester lisible par le
 * navigateur, contrairement aux cookies de session.
 */
export async function localeActive(): Promise<Locale> {
  try {
    const magasin = await cookies();
    return normaliserLocale(magasin.get(COOKIE_LANGUE)?.value);
  } catch {
    // Contexte sans requête (génération statique) : le français par défaut.
    return LOCALE_PAR_DEFAUT;
  }
}

/** Traducteur lié à la langue active. */
export async function traducteur(): Promise<(chaine: string) => string> {
  const locale = await localeActive();
  return (chaine: string) => traduire(chaine, locale);
}
