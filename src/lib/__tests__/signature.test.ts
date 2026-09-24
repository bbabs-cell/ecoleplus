/**
 * Présignature SigV4 — éprouvée contre le vecteur publié par AWS.
 *
 * Réimplémenter un algorithme cryptographique n'a de sens que si l'on peut
 * prouver qu'on l'a réimplémenté juste. AWS publie, dans sa documentation
 * « Signature Calculation for Presigned URL », un exemple complet dont la
 * signature attendue est connue. Si cette implémentation la reproduit au
 * caractère près, elle est exacte.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleDeStockage, horodatage, signerUrl } from '../r2/signature.ts';

// Identifiants d'exemple publiés par AWS dans sa documentation : ce ne sont
// pas des secrets, ils existent précisément pour être reproduits.
const ACCESS_KEY_EXEMPLE = 'AKIAIOSFODNN7EXAMPLE';
const SECRET_EXEMPLE = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

describe('vecteur de test AWS', () => {
  it('reproduit la signature documentée pour une URL présignée', () => {
    const url = signerUrl({
      methode: 'GET',
      endpoint: 'https://examplebucket.s3.amazonaws.com',
      bucket: '',
      cle: 'test.txt',
      region: 'us-east-1',
      accessKeyId: ACCESS_KEY_EXEMPLE,
      secretAccessKey: SECRET_EXEMPLE,
      expiration: 86400,
      instant: new Date('2013-05-24T00:00:00Z'),
    });

    // Signature attendue, telle que publiée par AWS.
    assert.ok(
      url.includes(
        'X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
      ),
      `signature inattendue dans ${url}`,
    );
  });

  it("place les paramètres dans l'ordre canonique", () => {
    const url = signerUrl({
      methode: 'GET',
      endpoint: 'https://examplebucket.s3.amazonaws.com',
      bucket: '',
      cle: 'test.txt',
      region: 'us-east-1',
      accessKeyId: ACCESS_KEY_EXEMPLE,
      secretAccessKey: SECRET_EXEMPLE,
      expiration: 86400,
      instant: new Date('2013-05-24T00:00:00Z'),
    });

    const requete = url.slice(url.indexOf('?') + 1);
    assert.ok(requete.startsWith('X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential='));
    assert.ok(requete.includes('X-Amz-Expires=86400'));
    assert.ok(requete.includes('X-Amz-SignedHeaders=host'));
  });
});

describe('horodatage', () => {
  it('produit les deux formes attendues par SigV4', () => {
    const { complet, jour } = horodatage(new Date('2013-05-24T00:00:00Z'));
    assert.equal(complet, '20130524T000000Z');
    assert.equal(jour, '20130524');
  });
});

describe('robustesse de la signature', () => {
  const base = {
    methode: 'GET',
    endpoint: 'https://compte.r2.cloudflarestorage.com',
    bucket: 'ecoleplus',
    region: 'auto',
    accessKeyId: ACCESS_KEY_EXEMPLE,
    secretAccessKey: SECRET_EXEMPLE,
    expiration: 300,
    instant: new Date('2026-09-24T12:00:00Z'),
  } as const;

  const signatureDe = (url: string) =>
    url.slice(url.indexOf('X-Amz-Signature=') + 'X-Amz-Signature='.length);

  it('change dès que la clé de l\'objet change', () => {
    const a = signerUrl({ ...base, cle: 'org/1/aaa' });
    const b = signerUrl({ ...base, cle: 'org/1/aab' });
    assert.notEqual(signatureDe(a), signatureDe(b));
  });

  it("change dès que la méthode change", () => {
    const lecture = signerUrl({ ...base, cle: 'org/1/aaa' });
    const depot = signerUrl({ ...base, methode: 'PUT', cle: 'org/1/aaa' });
    assert.notEqual(signatureDe(lecture), signatureDe(depot));
  });

  it("change dès que l'instant change — une URL ne vaut pas éternellement", () => {
    const a = signerUrl({ ...base, cle: 'org/1/aaa' });
    const b = signerUrl({ ...base, cle: 'org/1/aaa', instant: new Date('2026-09-25T12:00:00Z') });
    assert.notEqual(signatureDe(a), signatureDe(b));
  });

  it('encode les caractères que `encodeURIComponent` laisse passer', () => {
    const url = signerUrl({ ...base, cle: "org/1/a(b)c'd!e*f" });
    assert.ok(url.includes('%28') && url.includes('%29'), 'parenthèses encodées');
    assert.ok(url.includes('%27') && url.includes('%21'), 'apostrophe et point d\'exclamation');
    assert.ok(url.includes('%2A'), 'astérisque');
  });

  it('garde les barres du chemin comme séparateurs', () => {
    const url = signerUrl({ ...base, cle: 'org/1/dossier/fichier' });
    assert.ok(url.includes('/ecoleplus/org/1/dossier/fichier?'));
  });
});

describe('clé de stockage', () => {
  it("ne porte pas le nom d'origine du fichier", () => {
    const cle = cleDeStockage('11111111-1111-1111-1111-111111111111', 'abc-def');
    assert.equal(cle, 'org/11111111-1111-1111-1111-111111111111/abc-def');
    assert.ok(!cle.includes('.pdf'));
  });
});
