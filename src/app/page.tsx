import { redirect } from 'next/navigation';

export default function Accueil() {
  // Le middleware a déjà tranché : sans session il a renvoyé vers /connexion.
  redirect('/tableau-de-bord');
}
