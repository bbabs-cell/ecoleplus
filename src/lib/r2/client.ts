import 'server-only';
import { z } from 'zod';
import { cleDeStockage, signerUrl } from '@/lib/r2/signature';

/**
 * Accès à Cloudflare R2.
 *
 * `server-only` en tête n'est pas décoratif : importer ce module depuis un
 * composant client provoquerait une erreur de compilation. C'est la garantie
 * mécanique que la clé R2 ne peut pas partir au navigateur, là où un simple
 * commentaire ne garantirait rien.
 *
 * Le bucket est PRIVÉ. Le navigateur ne reçoit jamais de clé, seulement des
 * URL signées de courte durée, produites ici après vérification des
 * permissions par PostgreSQL.
 */

const schemaR2 = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

type ConfigR2 = z.infer<typeof schemaR2> & { endpoint: string; region: string };

let cache: ConfigR2 | null = null;

/** Erreur reconnaissable : l'interface sait alors expliquer quoi renseigner. */
export class R2NonConfigure extends Error {
  readonly variables: string[];

  constructor(variables: string[]) {
    super(
      `Stockage de fichiers non configuré : ${variables.join(', ')}. ` +
        'Renseignez ces variables (voir .env.example) pour activer les documents.',
    );
    this.name = 'R2NonConfigure';
    this.variables = variables;
  }
}

/**
 * Configuration R2, validée à la première lecture.
 *
 * Seuls les NOMS des variables manquantes apparaissent dans l'erreur : jamais
 * leur valeur, même tronquée (@CLAUDE.md, règle 6).
 */
export function configR2(): ConfigR2 {
  if (cache) return cache;

  const resultat = schemaR2.safeParse({
    R2_ACCOUNT_ID: process.env['R2_ACCOUNT_ID'],
    R2_ACCESS_KEY_ID: process.env['R2_ACCESS_KEY_ID'],
    R2_SECRET_ACCESS_KEY: process.env['R2_SECRET_ACCESS_KEY'],
    R2_BUCKET: process.env['R2_BUCKET'],
  });

  if (!resultat.success) {
    throw new R2NonConfigure(resultat.error.issues.map((probleme) => probleme.path.join('.')));
  }

  cache = {
    ...resultat.data,
    endpoint: `https://${resultat.data.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    // R2 ignore la région mais SigV4 l'exige dans la portée : « auto » est la
    // valeur que Cloudflare documente.
    region: 'auto',
  };
  return cache;
}

export function stockageConfigure(): boolean {
  try {
    configR2();
    return true;
  } catch {
    return false;
  }
}

/** Durée de vie des URL signées, en secondes. */
const VALIDITE_DEPOT = 300;
const VALIDITE_LECTURE = 60;

/**
 * URL de dépôt direct, valable cinq minutes.
 *
 * Le fichier part du navigateur vers R2 sans transiter par le serveur : une
 * pièce de 20 Mio n'a pas à traverser une fonction serverless. Le contrôle ne
 * s'en trouve pas affaibli, parce que rien n'est servi avant que le serveur
 * n'ait CONSTATÉ l'objet (`confirmer_fichier`).
 */
export function urlDeDepot(cle: string, typeMime: string): string {
  const config = configR2();
  return signerUrl({
    methode: 'PUT',
    endpoint: config.endpoint,
    bucket: config.R2_BUCKET,
    cle,
    region: config.region,
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    expiration: VALIDITE_DEPOT,
    parametres: { 'X-Amz-Content-Type': typeMime },
  });
}

/**
 * URL de lecture, valable une minute.
 *
 * Volontairement brève : une URL signée qui traîne dans un historique de
 * navigation ou un journal de proxy ne doit plus rien ouvrir. Le nom d'origine
 * est restitué par `response-content-disposition`, sans jamais figurer dans la
 * clé de stockage.
 */
export function urlDeLecture(cle: string, nomOrigine: string, typeMime: string): string {
  const config = configR2();
  return signerUrl({
    methode: 'GET',
    endpoint: config.endpoint,
    bucket: config.R2_BUCKET,
    cle,
    region: config.region,
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    expiration: VALIDITE_LECTURE,
    parametres: {
      'response-content-disposition': `attachment; filename="${nomOrigine.replace(/["\\]/g, '')}"`,
      'response-content-type': typeMime,
    },
  });
}

/**
 * Taille réellement stockée, constatée auprès de R2.
 *
 * C'est le point qui fait la différence entre « le navigateur dit que c'est
 * déposé » et « c'est déposé ». Rend `null` si l'objet n'existe pas.
 */
export async function tailleObjet(cle: string): Promise<number | null> {
  const config = configR2();
  const url = signerUrl({
    methode: 'HEAD',
    endpoint: config.endpoint,
    bucket: config.R2_BUCKET,
    cle,
    region: config.region,
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    expiration: VALIDITE_LECTURE,
  });

  const reponse = await fetch(url, { method: 'HEAD' });
  if (!reponse.ok) return null;

  const longueur = reponse.headers.get('content-length');
  if (longueur === null) return null;

  const taille = Number.parseInt(longueur, 10);
  return Number.isSafeInteger(taille) ? taille : null;
}

export { cleDeStockage };
