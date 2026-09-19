import { z } from 'zod';

/**
 * Schémas partagés par le formulaire et la Server Action.
 *
 * Le même schéma des deux côtés garantit que la validation du navigateur est un
 * confort, jamais une protection : le serveur revalide tout, systématiquement
 * (règles de code, 2).
 *
 * Les contraintes reprennent exactement celles des migrations. Un écart ferait
 * remonter une erreur PostgreSQL brute jusqu'à l'utilisateur.
 */

const texteCourt = z.string().trim();

export const emailSchema = texteCourt
  .min(1, 'Adresse e-mail requise')
  .max(320)
  .email('Adresse e-mail invalide');

export const localeSchema = texteCourt.regex(
  /^[a-z]{2}(-[A-Z]{2})?$/,
  'Code de langue invalide (ex. « fr » ou « fr-CA »)',
);

export const creationOrganisationSchema = z.object({
  nom: texteCourt.min(2, "Le nom doit comporter au moins 2 caractères").max(120),
  codePays: texteCourt.regex(/^[A-Z]{2}$/, 'Sélectionnez un pays'),
  fuseau: texteCourt.min(1, 'Sélectionnez un fuseau horaire'),
  devise: texteCourt.regex(/^[A-Z]{3}$/, 'Sélectionnez une devise'),
  langue: localeSchema,
});
export type CreationOrganisation = z.infer<typeof creationOrganisationSchema>;

export const majOrganisationSchema = z.object({
  nom: texteCourt.min(2, "Le nom doit comporter au moins 2 caractères").max(120),
  ville: texteCourt.max(120).optional().or(z.literal('')),
  adresse: texteCourt.max(300).optional().or(z.literal('')),
  telephone: texteCourt.max(40).optional().or(z.literal('')),
  email: z.union([emailSchema, z.literal('')]),
});
export type MajOrganisation = z.infer<typeof majOrganisationSchema>;

export const majReglagesSchema = z.object({
  langue: localeSchema,
  fuseau: texteCourt.min(1, 'Sélectionnez un fuseau horaire'),
  devise: texteCourt.regex(/^[A-Z]{3}$/, 'Sélectionnez une devise'),
  formatNom: z.enum(['GIVEN_FAMILY', 'FAMILY_GIVEN', 'FAMILY_UPPER_GIVEN']),
  formatDate: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY']),
  debutSemaine: z.coerce.number().int().min(1).max(7),
});
export type MajReglages = z.infer<typeof majReglagesSchema>;

// Le code reprend la contrainte `establishments_code_format` de la migration.
export const codeEtablissementSchema = texteCourt
  .toUpperCase()
  .regex(
    /^[A-Z0-9][A-Z0-9_-]{0,31}$/,
    'Le code doit commencer par une lettre ou un chiffre et ne contenir que A-Z, 0-9, « - » et « _ »',
  );

export const etablissementSchema = z.object({
  nom: texteCourt.min(2, "Le nom doit comporter au moins 2 caractères").max(160),
  code: codeEtablissementSchema,
  type: texteCourt.max(60).optional().or(z.literal('')),
  ville: texteCourt.max(120).optional().or(z.literal('')),
  telephone: texteCourt.max(40).optional().or(z.literal('')),
  email: z.union([emailSchema, z.literal('')]),
});
export type SaisieEtablissement = z.infer<typeof etablissementSchema>;

export const invitationSchema = z.object({
  email: emailSchema,
  roleId: z.string().uuid('Sélectionnez un rôle'),
  etablissements: z.array(z.string().uuid()).default([]),
});
export type SaisieInvitation = z.infer<typeof invitationSchema>;

export const connexionSchema = z.object({
  email: emailSchema,
  motDePasse: z.string().min(1, 'Mot de passe requis'),
});

export const inscriptionSchema = z.object({
  prenom: texteCourt.min(1, 'Prénom requis').max(80),
  nom: texteCourt.min(1, 'Nom requis').max(80),
  email: emailSchema,
  // Seuil volontairement placé sur la longueur, pas sur une composition
  // imposée : les règles de caractères poussent aux mots de passe prévisibles.
  motDePasse: z.string().min(12, 'Le mot de passe doit comporter au moins 12 caractères').max(200),
});
