import Link from 'next/link';
import { GraduationCap, LogOut } from 'lucide-react';
import { brand } from '@/config/brand';
import { exigerOrganisation } from '@/services/permissions';
import { deconnexionAction } from '@/services/auth.actions';
import { nomAffiche, initiales } from '@/lib/format';
import { Navigation, type EntreeNavigation } from '@/components/coque/navigation';
import { SelecteurEtablissement } from '@/components/coque/selecteur-etablissement';
import { Etiquette } from '@/components/ui/etiquette';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const contexte = await exigerOrganisation();
  const { permissions, reglages, profil, organisation, adhesion } = contexte;

  // Chaque entrée est conditionnée par la permission qui commande réellement la
  // page : un lien affiché sans droit mènerait à un écran vide ou refusé.
  const entrees: EntreeNavigation[] = [
    { href: '/tableau-de-bord', libelle: 'Tableau de bord', icone: 'tableau' },
    ...(permissions.has('establishments.read')
      ? [{ href: '/etablissements', libelle: 'Établissements', icone: 'etablissements' } as const]
      : []),

    // Domaine académique. Chaque entrée n'apparaît qu'avec la permission qui
    // commande réellement la page : un lien sans droit mènerait à un refus.
    ...(permissions.has('academic.read')
      ? [
          { href: '/annees', libelle: 'Années', icone: 'annees', separateur: true } as const,
          { href: '/niveaux', libelle: 'Niveaux', icone: 'niveaux' } as const,
          { href: '/matieres', libelle: 'Matières', icone: 'matieres' } as const,
        ]
      : []),
    ...(permissions.has('teachers.read')
      ? [{ href: '/enseignants', libelle: 'Enseignants', icone: 'enseignants' } as const]
      : []),
    ...(permissions.has('classes.read')
      ? [{ href: '/classes', libelle: 'Classes', icone: 'classes' } as const]
      : []),
    ...(permissions.has('learners.read')
      ? [{ href: '/apprenants', libelle: 'Apprenants', icone: 'apprenants' } as const]
      : []),

    ...(permissions.has('attendance.read')
      ? [{ href: '/presences', libelle: 'Présences', icone: 'presences' } as const]
      : []),

    ...(permissions.has('grades.read')
      ? [
          { href: '/evaluations', libelle: 'Évaluations', icone: 'evaluations' } as const,
          { href: '/baremes', libelle: 'Barèmes', icone: 'baremes' } as const,
        ]
      : []),
    // Les bulletins ont leur propre permission : consulter les notes et
    // consulter un bulletin remis ne sont pas le même droit.
    ...(permissions.has('reports.read')
      ? [{ href: '/bulletins', libelle: 'Bulletins', icone: 'bulletins' } as const]
      : []),

    ...(permissions.has('finance.read')
      ? [{ href: '/finances', libelle: 'Finances', icone: 'finances' } as const]
      : []),

    ...(permissions.has('members.read')
      ? [{ href: '/membres', libelle: 'Membres', icone: 'membres', separateur: true } as const]
      : []),
    ...(permissions.has('audit.read')
      ? [{ href: '/journal', libelle: "Journal d'audit", icone: 'journal' } as const]
      : []),
    ...(permissions.has('organization.read')
      ? [{ href: '/organisation', libelle: 'Organisation', icone: 'organisation' } as const]
      : []),
  ];

  const nom = nomAffiche(profil, reglages.name_display_format);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-bordure bg-surface-2/60 p-4 lg:h-dvh lg:w-64 lg:border-r lg:border-b-0">
        <Link href="/tableau-de-bord" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-douce bg-primaire text-primaire-contraste">
            <GraduationCap className="size-4" aria-hidden="true" />
          </span>
          <span className="truncate text-sm font-semibold tracking-tight text-encre">
            {brand.name}
          </span>
        </Link>

        <div className="space-y-1">
          <p className="truncate text-sm font-medium text-encre">{organisation.name}</p>
          <Etiquette ton={adhesion.role.code === 'OWNER' ? 'primaire' : 'neutre'}>
            {adhesion.role.label}
          </Etiquette>
        </div>

        <SelecteurEtablissement
          etablissements={contexte.etablissements.map(({ id, name }) => ({ id, name }))}
          actifId={contexte.etablissementActif?.id ?? null}
        />

        <div className="lg:flex-1">
          <Navigation entrees={entrees} />
        </div>

        <div className="flex items-center gap-2.5 border-t border-bordure pt-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-douce text-xs font-semibold text-accent"
            aria-hidden="true"
          >
            {initiales(profil, reglages.name_display_format)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-encre">{nom || 'Sans nom'}</p>
            <p className="truncate text-xs text-encre-douce">{contexte.utilisateur.email}</p>
          </div>
          <form action={deconnexionAction}>
            <button
              type="submit"
              className="rounded-douce p-2 text-encre-douce transition-colors hover:bg-surface-2 hover:text-encre"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
