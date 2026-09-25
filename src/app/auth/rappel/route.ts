import { NextResponse, type NextRequest } from 'next/server';
import { cheminInterne } from '@/lib/navigation';
import { clientServeur } from '@/lib/supabase/server';

/**
 * Point d'atterrissage des liens envoyés par e-mail.
 *
 * Supabase renvoie ici avec un `code` à usage unique ; l'échanger contre une
 * session est ce qui ouvre le droit de poser un nouveau mot de passe. Tant que
 * l'échange n'a pas eu lieu, le lien ne vaut rien.
 *
 * `suite` n'accepte qu'un chemin interne : un lien d'e-mail qui pourrait porter
 * une destination absolue ferait de cette route un tremplin de redirection.
 */
export async function GET(requete: NextRequest): Promise<NextResponse> {
  const code = requete.nextUrl.searchParams.get('code');
  const suite = cheminInterne(requete.nextUrl.searchParams.get('suite'));

  const echec = new URL('/mot-de-passe-oublie', requete.nextUrl.origin);
  echec.searchParams.set('expire', '1');

  if (!code) return NextResponse.redirect(echec);

  const supabase = await clientServeur();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // Un lien déjà consommé, expiré ou forgé ne se distingue pas ici : tous
  // repartent vers la demande d'un nouveau lien, sans dire lequel des trois.
  if (error) return NextResponse.redirect(echec);

  return NextResponse.redirect(new URL(suite, requete.nextUrl.origin));
}
