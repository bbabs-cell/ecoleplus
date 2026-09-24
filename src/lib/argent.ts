/**
 * Montants en unité mineure entière.
 *
 * Toute la base stocke l'argent en entiers : centimes, francs CFA. Ce module
 * est la seule frontière où ces entiers deviennent du texte lisible, et où du
 * texte saisi redevient un entier.
 *
 * Aucune addition, soustraction ou division de montant ne se fait ici : les
 * calculs vivent en SQL, sur des `bigint`. Ce fichier ne fait que convertir.
 */

/**
 * Nombre de décimales d'une devise.
 *
 * L'euro en a deux, le franc CFA zéro, le dinar tunisien trois. Le supposer
 * revient à choisir un pays (@CLAUDE.md, règle 2) : on demande à `Intl`.
 */
export function decimalesDevise(devise: string): number {
  try {
    return (
      new Intl.NumberFormat('fr', { style: 'currency', currency: devise }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    // Code de devise inconnu : deux décimales, le cas le plus répandu.
    return 2;
  }
}

/** Chaîne décimale EXACTE d'un montant en unité mineure — sans flottant. */
function chaineDecimale(mineur: number, decimales: number): string {
  const negatif = mineur < 0;
  const absolu = Math.abs(Math.trunc(mineur)).toString();

  if (decimales === 0) return (negatif ? '-' : '') + absolu;

  const rembourre = absolu.padStart(decimales + 1, '0');
  const entier = rembourre.slice(0, rembourre.length - decimales);
  const fraction = rembourre.slice(rembourre.length - decimales);
  return `${negatif ? '-' : ''}${entier}.${fraction}`;
}

/**
 * Montant en unité mineure rendu dans la devise et la langue demandées.
 *
 * La valeur est passée à `Intl` sous forme de CHAÎNE : `format` accepte les
 * chaînes et les traite exactement, là où une division par 100 introduirait
 * une approximation binaire.
 */
export function formaterMontant(mineur: number | null, devise: string, locale = 'fr'): string {
  if (mineur === null || mineur === undefined) return '—';

  const decimales = decimalesDevise(devise);
  const exact = chaineDecimale(mineur, decimales);

  try {
    const format = new Intl.NumberFormat(locale, { style: 'currency', currency: devise });
    // `format` accepte une chaîne depuis ES2023 ; le repli couvre les moteurs
    // plus anciens, au prix d'une conversion en nombre.
    return format.format(exact as unknown as number);
  } catch {
    return `${exact} ${devise}`;
  }
}

/** Le même montant sans symbole, pour les tableaux qui portent la devise en en-tête. */
export function formaterMontantNu(mineur: number | null, devise: string, locale = 'fr'): string {
  if (mineur === null || mineur === undefined) return '—';
  const decimales = decimalesDevise(devise);
  const exact = chaineDecimale(mineur, decimales);
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(exact as unknown as number);
  } catch {
    return exact;
  }
}

/**
 * Texte saisi converti en unité mineure entière.
 *
 * La conversion se fait sur les CHIFFRES, pas sur un nombre : « 1 234,56 » est
 * découpé en « 1234 » et « 56 » puis recomposé en 123456. Multiplier
 * `parseFloat('1234.56')` par 100 donnerait 123455,99999999999.
 *
 * Rend `null` quand la saisie n'est pas un montant exploitable — au lieu de
 * rendre zéro, qui serait un montant.
 */
export function enUniteMineure(saisie: string, devise: string): number | null {
  const decimales = decimalesDevise(devise);
  const nettoye = saisie.trim().replace(/[\s  ]/g, '').replace(',', '.');

  if (nettoye === '') return null;
  if (!/^-?\d*(\.\d*)?$/.test(nettoye)) return null;

  const negatif = nettoye.startsWith('-');
  const [entierBrut = '', fractionBrute = ''] = nettoye.replace('-', '').split('.');
  const entier = entierBrut === '' ? '0' : entierBrut;

  if (entier === '0' && fractionBrute.replace(/0/g, '') === '') {
    return fractionBrute === '' && entierBrut === '' ? null : 0;
  }

  // Une saisie plus précise que la devise est refusée plutôt que tronquée :
  // arrondir en silence, c'est perdre de l'argent sans le dire.
  if (fractionBrute.length > decimales) return null;

  const fraction = fractionBrute.padEnd(decimales, '0');
  const total = Number(entier + fraction);

  if (!Number.isSafeInteger(total)) return null;
  return negatif ? -total : total;
}

/** Montant en unité mineure rendu pour un champ de saisie (sans séparateur). */
export function versChampSaisie(mineur: number | null, devise: string): string {
  if (mineur === null || mineur === undefined) return '';
  return chaineDecimale(mineur, decimalesDevise(devise));
}
