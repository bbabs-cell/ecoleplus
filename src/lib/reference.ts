/**
 * Référentiels ouverts.
 *
 * Fuseaux et devises viennent d'`Intl` : la liste suit la base IANA/ISO du
 * runtime au lieu d'être figée dans le code. Les noms de pays et de langues
 * sont rendus via `Intl.DisplayNames`, donc traduits dans la langue de
 * l'utilisateur — aucun libellé n'est écrit en dur (CLAUDE.md, règle 2).
 */

type ValeursIntl = 'timeZone' | 'currency';

function valeursSupportees(cle: ValeursIntl): string[] {
  const avecSupport = Intl as typeof Intl & {
    supportedValuesOf?: (cle: string) => string[];
  };
  try {
    return avecSupport.supportedValuesOf?.(cle) ?? [];
  } catch {
    return [];
  }
}

export function fuseauxHoraires(): string[] {
  const liste = valeursSupportees('timeZone');
  return liste.length > 0 ? liste : ['UTC'];
}

export function devises(): string[] {
  const liste = valeursSupportees('currency');
  return liste.length > 0 ? liste : ['EUR', 'USD', 'XOF'];
}

/** ISO 3166-1 alpha-2. Codes seuls : les noms sont rendus par `Intl`. */
export const CODES_PAYS: readonly string[] = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
  'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
  'DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET',
  'FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
  'HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
  'JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
  'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
  'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
  'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM',
  'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA',
  'RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
  'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
  'UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW',
];

/** Langues proposées à l'interface. L'arabe impose la gestion du RTL (phase 5). */
export const LANGUES: readonly string[] = ['fr', 'en', 'ar', 'es'];

export function nomPays(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function nomLangue(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function nomDevise(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}
