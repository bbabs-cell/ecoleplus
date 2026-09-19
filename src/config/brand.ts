/**
 * Identité de la marque — source unique.
 *
 * Le nom du produit est provisoire (cf. CLAUDE.md) : il ne doit apparaître en
 * dur nulle part ailleurs, ni dans un composant, ni dans un libellé, ni dans un
 * gabarit d'e-mail. Le renommer se fait ici, et seulement ici.
 */
export const brand = {
  name: 'EcolePlus',
  legalName: 'EcolePlus',
  tagline: 'Gestion scolaire et universitaire',
  description:
    "Plateforme de gestion pour établissements scolaires et universitaires, de la maternelle à l'enseignement supérieur.",
  supportEmail: 'support@ecoleplus.example',
} as const;

export type Brand = typeof brand;
