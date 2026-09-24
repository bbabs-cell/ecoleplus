import { createHash, createHmac } from 'node:crypto';

/**
 * Présignature d'URL S3 (AWS Signature Version 4), pour Cloudflare R2.
 *
 * Écrit à la main plutôt qu'en tirant le SDK AWS : l'algorithme est
 * entièrement spécifié, il tient en une centaine de lignes, et AWS publie un
 * vecteur de test qui permet de prouver que cette implémentation est exacte
 * (voir `src/lib/__tests__/signature.test.ts`). Deux dépendances de plusieurs
 * mégaoctets pour cela ne se justifiaient pas (@docs/regles-code.md, 12).
 *
 * Ce module est SERVEUR UNIQUEMENT. Le secret R2 ne doit jamais atteindre le
 * navigateur : c'est la raison d'être de l'URL signée — le client reçoit un
 * droit d'accès limité dans le temps, jamais la clé qui l'a produit.
 */

const ALGORITHME = 'AWS4-HMAC-SHA256';

/**
 * Encodage RFC 3986, celui qu'attend SigV4.
 *
 * `encodeURIComponent` laisse passer `!'()*`, qu'AWS encode. L'oublier produit
 * une signature valide pour un chemin et fausse pour un autre — le genre de
 * défaut qui ne se voit que sur certains noms de fichiers.
 */
function encoder(valeur: string): string {
  return encodeURIComponent(valeur).replace(
    /[!'()*]/g,
    (caractere) => `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Le chemin s'encode segment par segment : les `/` restent des séparateurs. */
function encoderChemin(chemin: string): string {
  return chemin
    .split('/')
    .map((segment) => encoder(segment))
    .join('/');
}

function sha256Hex(valeur: string): string {
  return createHash('sha256').update(valeur, 'utf8').digest('hex');
}

function hmac(cle: Buffer | string, valeur: string): Buffer {
  return createHmac('sha256', cle).update(valeur, 'utf8').digest();
}

/** Chaîne de dérivation : date, région, service, puis la constante de fin. */
function cleDeSignature(secret: string, date: string, region: string, service: string): Buffer {
  const parDate = hmac(`AWS4${secret}`, date);
  const parRegion = hmac(parDate, region);
  const parService = hmac(parRegion, service);
  return hmac(parService, 'aws4_request');
}

/** Horodatage SigV4 : `20130524T000000Z` et `20130524`. */
export function horodatage(instant: Date): { complet: string; jour: string } {
  const complet = instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return { complet, jour: complet.slice(0, 8) };
}

export interface ParametresSignature {
  methode: 'GET' | 'PUT' | 'HEAD';
  /** `https://<compte>.r2.cloudflarestorage.com` — sans barre finale. */
  endpoint: string;
  bucket: string;
  /** Clé de l'objet, sans barre initiale. */
  cle: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Durée de validité, en secondes. */
  expiration: number;
  instant?: Date;
  /** En-têtes signés en plus de `host` — noms en minuscules. */
  entetes?: Record<string, string>;
  /** Paramètres de requête ajoutés avant signature (ex. `response-content-disposition`). */
  parametres?: Record<string, string>;
}

/**
 * URL présignée.
 *
 * La charge utile n'est pas signée (`UNSIGNED-PAYLOAD`) : pour un dépôt direct
 * depuis le navigateur, le serveur ne connaît pas le contenu au moment où il
 * signe. C'est ce qui rend le contrôle de taille et de type côté serveur
 * indispensable APRÈS le dépôt, et non seulement avant.
 */
export function signerUrl(parametres: ParametresSignature): string {
  const instant = parametres.instant ?? new Date();
  const { complet, jour } = horodatage(instant);

  const hote = new URL(parametres.endpoint).host;
  // R2 met le bucket dans le CHEMIN ; le vecteur de test d'AWS le met dans
  // l'hôte. Les deux formes doivent signer juste, d'où ce bucket facultatif.
  const chemin = parametres.bucket ? `/${parametres.bucket}/${parametres.cle}` : `/${parametres.cle}`;

  const entetes: Record<string, string> = { host: hote, ...(parametres.entetes ?? {}) };
  const nomsSignes = Object.keys(entetes)
    .map((nom) => nom.toLowerCase())
    .sort();

  const enteteCanonique =
    nomsSignes
      .map((nom) => `${nom}:${String(entetes[nom] ?? entetes[nom.toLowerCase()]).trim()}`)
      .join('\n') + '\n';
  const enteteSignee = nomsSignes.join(';');

  const portee = `${jour}/${parametres.region}/s3/aws4_request`;

  const requete: Record<string, string> = {
    ...(parametres.parametres ?? {}),
    'X-Amz-Algorithm': ALGORITHME,
    'X-Amz-Credential': `${parametres.accessKeyId}/${portee}`,
    'X-Amz-Date': complet,
    'X-Amz-Expires': String(parametres.expiration),
    'X-Amz-SignedHeaders': enteteSignee,
  };

  // Tri lexicographique sur la clé ENCODÉE, comme l'exige la spécification.
  const requeteCanonique = Object.keys(requete)
    .map((cle) => [encoder(cle), encoder(requete[cle] ?? '')] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([cle, valeur]) => `${cle}=${valeur}`)
    .join('&');

  const requeteCanoniqueComplete = [
    parametres.methode,
    encoderChemin(chemin),
    requeteCanonique,
    enteteCanonique,
    enteteSignee,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const aSigner = [ALGORITHME, complet, portee, sha256Hex(requeteCanoniqueComplete)].join('\n');

  const signature = createHmac(
    'sha256',
    cleDeSignature(parametres.secretAccessKey, jour, parametres.region, 's3'),
  )
    .update(aSigner, 'utf8')
    .digest('hex');

  return `${parametres.endpoint}${encoderChemin(chemin)}?${requeteCanonique}&X-Amz-Signature=${signature}`;
}

/**
 * Clé de stockage imprévisible.
 *
 * « Clé de stockage imprévisible, URL signée, jamais d'accès par simple
 * connaissance de l'URL » (@docs/architecture.md). Le nom d'origine du fichier
 * n'entre pas dans la clé : deviner `dossiers/awa-sow/bulletin.pdf` ne doit
 * mener nulle part, et un nom de fichier peut trahir une information
 * personnelle par sa seule présence dans une URL.
 */
export function cleDeStockage(organisationId: string, identifiantFichier: string): string {
  return `org/${organisationId}/${identifiantFichier}`;
}
