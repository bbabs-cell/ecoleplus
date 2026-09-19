import { z } from 'zod';

/**
 * Variables d'environnement, validées à la première lecture.
 *
 * La validation est paresseuse et non exécutée à l'import : le build doit
 * pouvoir aboutir sur une machine sans secrets (CI, image Docker). L'absence
 * d'une variable se manifeste alors à la première requête, avec un message
 * explicite plutôt qu'un « undefined » propagé jusqu'à Supabase.
 *
 * Aucune valeur n'est jamais journalisée : seul le NOM de la variable manquante
 * apparaît dans l'erreur (CLAUDE.md, règle 6).
 */
const schemaPublic = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL doit être une URL valide"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

type EnvPublic = z.infer<typeof schemaPublic>;

let cache: EnvPublic | null = null;

export function envPublic(): EnvPublic {
  if (cache) return cache;

  // Next.js remplace `process.env.NEXT_PUBLIC_*` à la compilation : les clés
  // doivent être écrites littéralement, pas construites dynamiquement.
  const resultat = schemaPublic.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!resultat.success) {
    const manquantes = resultat.error.issues
      .map((probleme) => probleme.path.join('.'))
      .join(', ');
    throw new Error(
      `Configuration Supabase absente ou invalide : ${manquantes}. ` +
        'Renseignez ces variables (voir .env.example) avant de lancer l\'application.',
    );
  }

  cache = resultat.data;
  return cache;
}
