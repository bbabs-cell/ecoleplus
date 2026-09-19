import type { NameDisplayFormat, OrganizationSettings } from '@/lib/types/database';

interface Nommable {
  given_name: string;
  family_name: string;
}

/**
 * Compose un nom selon l'ordre retenu par l'organisation.
 *
 * « Prénom Nom » n'a rien d'universel : de nombreux systèmes placent le nom de
 * famille en tête, souvent en capitales (CLAUDE.md, règle 2).
 */
export function nomAffiche(
  personne: Nommable,
  format: NameDisplayFormat = 'GIVEN_FAMILY',
): string {
  const prenom = personne.given_name.trim();
  const nom = personne.family_name.trim();

  if (!prenom && !nom) return '';

  switch (format) {
    case 'FAMILY_GIVEN':
      return [nom, prenom].filter(Boolean).join(' ');
    case 'FAMILY_UPPER_GIVEN':
      return [nom.toLocaleUpperCase(), prenom].filter(Boolean).join(' ');
    case 'GIVEN_FAMILY':
      return [prenom, nom].filter(Boolean).join(' ');
  }
}

/** Initiales pour les avatars, dans l'ordre d'affichage de l'organisation. */
export function initiales(personne: Nommable, format: NameDisplayFormat = 'GIVEN_FAMILY'): string {
  const affiche = nomAffiche(personne, format);
  const morceaux = affiche.split(/\s+/).filter(Boolean);
  const retenus = [morceaux[0], morceaux[1]].filter((m): m is string => Boolean(m));
  return retenus.map((m) => [...m][0] ?? '').join('').toLocaleUpperCase() || '?';
}

type ReglagesFormat = Pick<OrganizationSettings, 'timezone' | 'date_format' | 'default_locale'>;

/**
 * Date seule, dans le fuseau et le motif de l'organisation.
 *
 * Le motif explicite l'emporte sur la convention de la locale : deux
 * établissements partageant une langue peuvent écrire les dates autrement.
 */
export function formaterDate(valeur: string | Date, reglages: ReglagesFormat): string {
  const date = typeof valeur === 'string' ? new Date(valeur) : valeur;
  if (Number.isNaN(date.getTime())) return '';

  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: reglages.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const lire = (type: Intl.DateTimeFormatPartTypes): string =>
    parties.find((partie) => partie.type === type)?.value ?? '';

  return reglages.date_format
    .replace('YYYY', lire('year'))
    .replace('MM', lire('month'))
    .replace('DD', lire('day'));
}

/** Date et heure — laissées à Intl, qui connaît les conventions de la locale. */
export function formaterDateHeure(valeur: string | Date, reglages: ReglagesFormat): string {
  const date = typeof valeur === 'string' ? new Date(valeur) : valeur;
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(reglages.default_locale, {
    timeZone: reglages.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
