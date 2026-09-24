import { NextResponse } from 'next/server';
import { clientServeur } from '@/lib/supabase/server';
import { R2NonConfigure, urlDeLecture } from '@/lib/r2/client';

/**
 * Téléchargement d'un document.
 *
 * L'URL signée n'est JAMAIS rendue au navigateur dans une page : elle est
 * produite ici, à la demande, et immédiatement suivie d'une redirection. Une
 * URL signée qui figurerait dans du HTML se retrouverait dans un cache, un
 * historique ou un journal de proxy, et resterait valable pour quiconque la
 * lirait.
 *
 * La vérification se fait en deux temps, et c'est volontaire :
 *   - `fichier_telechargeable` tranche dans PostgreSQL — organisation,
 *     établissement, permission, statut du dépôt, suppression ;
 *   - la signature n'est calculée qu'après, avec une validité d'une minute.
 *
 * Connaître un identifiant de fichier ne donne donc rien, et une URL signée
 * récupérée ailleurs expire avant d'être utile.
 */
export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexte.params;

  const supabase = await clientServeur();
  const { data, error } = await supabase
    .rpc('fichier_telechargeable', { p_file_id: id })
    .maybeSingle();

  // Le message ne distingue pas « inexistant » de « interdit » : confirmer
  // qu'un document existe ailleurs est déjà une fuite.
  if (error || !data) {
    return NextResponse.json({ erreur: 'Document introuvable.' }, { status: 404 });
  }

  try {
    const url = urlDeLecture(data.cle_stockage, data.nom_origine, data.type_mime);
    return NextResponse.redirect(url, {
      status: 302,
      // Aucune mise en cache : la redirection porte une URL éphémère.
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (erreur) {
    if (erreur instanceof R2NonConfigure) {
      return NextResponse.json({ erreur: erreur.message }, { status: 503 });
    }
    throw erreur;
  }
}
