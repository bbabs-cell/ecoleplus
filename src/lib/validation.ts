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

// ---------------------------------------------------------------------------
// Domaine académique (phase 2)
// ---------------------------------------------------------------------------
// Les contraintes reprennent celles des migrations 0009 à 0011. Le libellé des
// années, le découpage en périodes et le nom des niveaux restent du texte
// libre : aucune forme n'est imposée à un système éducatif (CLAUDE.md, règle 2).

const dateIso = texteCourt.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide');

/** Code court partagé par niveaux, matières, classes et groupes. */
export const codeReferentielSchema = texteCourt
  .toUpperCase()
  .regex(
    /^[A-Z0-9][A-Z0-9_-]{0,31}$/,
    'Le code doit commencer par une lettre ou un chiffre et ne contenir que A-Z, 0-9, « - » et « _ »',
  );

export const anneeSchema = z
  .object({
    nom: texteCourt.min(2, 'Le libellé doit comporter au moins 2 caractères').max(60),
    debut: dateIso,
    fin: dateIso,
  })
  .refine((valeurs) => valeurs.fin > valeurs.debut, {
    message: 'La fin doit être postérieure au début',
    path: ['fin'],
  });
export type SaisieAnnee = z.infer<typeof anneeSchema>;

export const periodeSchema = z
  .object({
    nom: texteCourt.min(1, 'Libellé requis').max(60),
    type: texteCourt.max(40).optional().or(z.literal('')),
    position: z.coerce.number().int().min(1).max(24),
    debut: dateIso,
    fin: dateIso,
  })
  .refine((valeurs) => valeurs.fin > valeurs.debut, {
    message: 'La fin doit être postérieure au début',
    path: ['fin'],
  });
export type SaisiePeriode = z.infer<typeof periodeSchema>;

export const niveauSchema = z.object({
  nom: texteCourt.min(1, 'Nom requis').max(80),
  code: codeReferentielSchema,
  cycle: texteCourt.max(60).optional().or(z.literal('')),
  position: z.coerce.number().int().min(0).max(999),
});
export type SaisieNiveau = z.infer<typeof niveauSchema>;

export const matiereSchema = z.object({
  nom: texteCourt.min(1, 'Nom requis').max(120),
  code: codeReferentielSchema,
  description: texteCourt.max(300).optional().or(z.literal('')),
});
export type SaisieMatiere = z.infer<typeof matiereSchema>;

export const enseignantSchema = z.object({
  prenom: texteCourt.max(80).optional().or(z.literal('')),
  nom: texteCourt.min(1, 'Nom requis').max(80),
  email: z.union([emailSchema, z.literal('')]),
  telephone: texteCourt.max(40).optional().or(z.literal('')),
  code: z
    .union([codeReferentielSchema, z.literal('')])
    .optional(),
  dateEmbauche: z.union([dateIso, z.literal('')]).optional(),
});
export type SaisieEnseignant = z.infer<typeof enseignantSchema>;

export const classeSchema = z.object({
  nom: texteCourt.min(1, 'Nom requis').max(80),
  code: codeReferentielSchema,
  niveauId: z.string().uuid('Sélectionnez un niveau'),
  // Vide = pas de plafond d'effectif.
  capacite: z
    .union([z.coerce.number().int().min(1).max(2000), z.literal('')])
    .optional(),
  enseignantPrincipalId: z.union([z.string().uuid(), z.literal('')]).optional(),
});
export type SaisieClasse = z.infer<typeof classeSchema>;

const STATUTS_INSCRIPTION = [
  'PREREGISTERED',
  'ENROLLED',
  'ACTIVE',
  'SUSPENDED',
  'TRANSFERRED',
  'GRADUATED',
  'DROPPED_OUT',
  'ARCHIVED',
] as const;

export const statutInscriptionSchema = z.enum(STATUTS_INSCRIPTION);

export const inscriptionApprenantSchema = z.object({
  prenom: texteCourt.max(80).optional().or(z.literal('')),
  nom: texteCourt.min(1, 'Nom requis').max(80),
  anneeId: z.string().uuid('Sélectionnez une année académique'),
  niveauId: z.union([z.string().uuid(), z.literal('')]).optional(),
  classeId: z.union([z.string().uuid(), z.literal('')]).optional(),
  dateNaissance: z.union([dateIso, z.literal('')]).optional(),
  genre: texteCourt.max(40).optional().or(z.literal('')),
  matricule: texteCourt.max(40).optional().or(z.literal('')),
  email: z.union([emailSchema, z.literal('')]),
  telephone: texteCourt.max(40).optional().or(z.literal('')),
  statut: statutInscriptionSchema,
});
export type SaisieInscriptionApprenant = z.infer<typeof inscriptionApprenantSchema>;

export const apprenantSchema = z.object({
  prenom: texteCourt.max(80).optional().or(z.literal('')),
  nom: texteCourt.min(1, 'Nom requis').max(80),
  dateNaissance: z.union([dateIso, z.literal('')]).optional(),
  lieuNaissance: texteCourt.max(120).optional().or(z.literal('')),
  genre: texteCourt.max(40).optional().or(z.literal('')),
  nationalite: texteCourt.max(80).optional().or(z.literal('')),
  matricule: texteCourt.max(40).optional().or(z.literal('')),
  email: z.union([emailSchema, z.literal('')]),
  telephone: texteCourt.max(40).optional().or(z.literal('')),
  adresse: texteCourt.max(300).optional().or(z.literal('')),
});
export type SaisieApprenant = z.infer<typeof apprenantSchema>;

export const affectationSchema = z.object({
  classeId: z.string().uuid('Sélectionnez une classe'),
  matiereId: z.string().uuid('Sélectionnez une matière'),
  enseignantId: z.string().uuid('Sélectionnez un enseignant'),
});
export type SaisieAffectation = z.infer<typeof affectationSchema>;

// ---------------------------------------------------------------------------
// Présences (phase 3a)
// ---------------------------------------------------------------------------

export const seanceSchema = z
  .object({
    classeId: z.string().uuid('Sélectionnez une classe'),
    date: dateIso,
    matiereId: z.union([z.string().uuid(), z.literal('')]).optional(),
    enseignantId: z.union([z.string().uuid(), z.literal('')]).optional(),
    type: texteCourt.max(40).optional().or(z.literal('')),
    debut: z.union([texteCourt.regex(/^\d{2}:\d{2}$/, 'Heure invalide'), z.literal('')]).optional(),
    fin: z.union([texteCourt.regex(/^\d{2}:\d{2}$/, 'Heure invalide'), z.literal('')]).optional(),
  })
  .refine(
    (v) => !v.debut || !v.fin || v.fin > v.debut,
    { message: 'La fin doit être postérieure au début', path: ['fin'] },
  );
export type SaisieSeance = z.infer<typeof seanceSchema>;

export const statutPresenceSchema = z.object({
  nom: texteCourt.min(1, 'Nom requis').max(60),
  code: codeReferentielSchema,
  estPresent: z.coerce.boolean(),
  compteAbsence: z.coerce.boolean(),
  exigeJustificatif: z.coerce.boolean(),
});
export type SaisieStatutPresence = z.infer<typeof statutPresenceSchema>;
