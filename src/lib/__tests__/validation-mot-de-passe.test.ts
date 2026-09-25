import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { motDePasseOublieSchema, nouveauMotDePasseSchema } from '../validation.ts';

describe('nouveauMotDePasseSchema', () => {
  it('accepte deux saisies identiques d’au moins douze caractères', () => {
    const resultat = nouveauMotDePasseSchema.safeParse({
      motDePasse: 'une phrase de passe',
      confirmation: 'une phrase de passe',
    });
    assert.equal(resultat.success, true);
  });

  it('refuse deux saisies qui diffèrent, et le signale sur la confirmation', () => {
    const resultat = nouveauMotDePasseSchema.safeParse({
      motDePasse: 'une phrase de passe',
      confirmation: 'une phrase de passé',
    });
    assert.equal(resultat.success, false);
    assert.equal(resultat.error?.issues[0]?.path[0], 'confirmation');
  });

  it('refuse un mot de passe trop court, même confirmé', () => {
    const resultat = nouveauMotDePasseSchema.safeParse({
      motDePasse: 'court',
      confirmation: 'court',
    });
    assert.equal(resultat.success, false);
    assert.equal(resultat.error?.issues[0]?.path[0], 'motDePasse');
  });

  // La longueur est le seul critère : aucune composition n'est imposée, donc
  // une phrase entièrement en minuscules doit passer.
  it('n’impose ni chiffre, ni majuscule, ni caractère spécial', () => {
    const resultat = nouveauMotDePasseSchema.safeParse({
      motDePasse: 'bonjour tout le monde',
      confirmation: 'bonjour tout le monde',
    });
    assert.equal(resultat.success, true);
  });
});

describe('motDePasseOublieSchema', () => {
  it('refuse une adresse invalide', () => {
    assert.equal(motDePasseOublieSchema.safeParse({ email: 'pas-une-adresse' }).success, false);
  });

  it('accepte une adresse valide', () => {
    assert.equal(motDePasseOublieSchema.safeParse({ email: 'a@b.test' }).success, true);
  });
});
