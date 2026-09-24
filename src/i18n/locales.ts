/**
 * Langues de l'interface.
 *
 * Module SANS AUCUN IMPORT : il est lu aussi bien par la mise en page racine
 * que par des composants clients.
 *
 * Le parti pris, repris de la conception antérieure : **la clé de traduction
 * est la chaîne française exacte**. Une chaîne non traduite s'affiche donc
 * telle quelle, en français, plutôt qu'en `dashboard.title.label`. L'interface
 * reste lisible même à moitié traduite — propriété que peu de solutions
 * offrent, et qui permet de traduire écran par écran sans jamais casser
 * l'application.
 */

export const LOCALES = ['fr', 'en', 'ar', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_PAR_DEFAUT: Locale = 'fr';

export const NOMS_LOCALES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
  es: 'Español',
};

/** Langues écrites de droite à gauche. */
const RTL = new Set<string>(['ar', 'he', 'fa', 'ur']);

export function estLocaleConnue(valeur: string | undefined | null): valeur is Locale {
  return valeur !== null && valeur !== undefined && (LOCALES as readonly string[]).includes(valeur);
}

/**
 * Direction d'écriture.
 *
 * Déduite du code de langue, jamais d'une liste de pays : c'est la langue qui
 * porte la direction, et `ar-MA` s'écrit de droite à gauche comme `ar`.
 */
export function direction(locale: string): 'ltr' | 'rtl' {
  const base = locale.split('-')[0] ?? '';
  return RTL.has(base) ? 'rtl' : 'ltr';
}

/** Normalise `fr-CA` en `fr` quand la variante n'est pas gérée. */
export function normaliserLocale(valeur: string | undefined | null): Locale {
  if (!valeur) return LOCALE_PAR_DEFAUT;
  if (estLocaleConnue(valeur)) return valeur;
  const base = valeur.split('-')[0];
  return estLocaleConnue(base) ? base : LOCALE_PAR_DEFAUT;
}

export const COOKIE_LANGUE = 'ecoleplus-langue';
