import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, GraduationCap, MailPlus, School, Users, UsersRound } from 'lucide-react';
import { exigerOrganisation } from '@/services/permissions';
import { statistiquesAcademiques, statistiquesSocle } from '@/services/tableau-de-bord';
import { nomAffiche } from '@/lib/format';
import { nomPays } from '@/lib/reference';
import { Carte, CorpsCarte } from '@/components/ui/carte';
import { Alerte } from '@/components/ui/alerte';
import { Etiquette } from '@/components/ui/etiquette';

export const metadata: Metadata = { title: 'Tableau de bord' };

function Indicateur({
  libelle,
  valeur,
  Icone,
  href,
}: {
  libelle: string;
  valeur: number;
  Icone: typeof Users;
  href?: string;
}) {
  const contenu = (
    <Carte className="h-full transition-shadow hover:shadow-relief">
      <CorpsCarte className="flex items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-douce bg-primaire-douce text-primaire">
          <Icone className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums text-encre">{valeur}</p>
          <p className="truncate text-sm text-encre-douce">{libelle}</p>
        </div>
      </CorpsCarte>
    </Carte>
  );

  return href ? (
    <Link href={href} className="block">
      {contenu}
    </Link>
  ) : (
    contenu
  );
}

export default async function PageTableauDeBord() {
  const contexte = await exigerOrganisation();
  const { permissions, reglages, organisation, profil, adhesion } = contexte;

  const stats = await statistiquesSocle(permissions.has('members.invite'));

  // Les chiffres académiques n'ont de sens qu'avec un établissement de travail
  // et la permission de le consulter.
  const academique =
    contexte.etablissementActif && permissions.has('learners.read')
      ? await statistiquesAcademiques(contexte.etablissementActif.id)
      : null;
  const prenom = nomAffiche(profil, reglages.name_display_format).split(' ')[0] ?? '';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-encre">
          Bonjour{prenom ? ` ${prenom}` : ''}
        </h1>
        <p className="text-sm text-encre-douce">
          {organisation.name} · {nomPays(organisation.country_code, reglages.default_locale)} ·{' '}
          <Etiquette>{adhesion.role.label}</Etiquette>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Indicateur
          libelle={stats.etablissements > 1 ? 'Établissements actifs' : 'Établissement actif'}
          valeur={stats.etablissements}
          Icone={Building2}
          href={permissions.has('establishments.read') ? '/etablissements' : undefined}
        />
        <Indicateur
          libelle={stats.membres > 1 ? 'Membres actifs' : 'Membre actif'}
          valeur={stats.membres}
          Icone={Users}
          href={permissions.has('members.read') ? '/membres' : undefined}
        />
        {stats.invitationsEnAttente !== null ? (
          <Indicateur
            libelle="Invitations en attente"
            valeur={stats.invitationsEnAttente}
            Icone={MailPlus}
            href="/membres"
          />
        ) : null}
      </div>

      {academique ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-encre">
            Année en cours
            {academique.anneeNom ? (
              <span className="font-normal text-encre-douce"> · {academique.anneeNom}</span>
            ) : null}
          </h2>

          {academique.anneeNom ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Indicateur
                libelle="Apprenants inscrits"
                valeur={academique.apprenantsActifs}
                Icone={UsersRound}
                href="/apprenants"
              />
              <Indicateur
                libelle={academique.classes > 1 ? 'Classes ouvertes' : 'Classe ouverte'}
                valeur={academique.classes}
                Icone={School}
                href={permissions.has('classes.read') ? '/classes' : undefined}
              />
              <Indicateur
                libelle={academique.enseignants > 1 ? 'Enseignants actifs' : 'Enseignant actif'}
                valeur={academique.enseignants}
                Icone={GraduationCap}
                href={permissions.has('teachers.read') ? '/enseignants' : undefined}
              />
            </div>
          ) : (
            <Alerte ton="info" titre="Aucune année académique en cours">
              Désignez une année courante pour suivre les effectifs.{' '}
              {permissions.has('academic.manage') ? (
                <Link href="/annees" className="font-medium text-primaire">
                  Gérer les années
                </Link>
              ) : null}
            </Alerte>
          )}
        </section>
      ) : null}

      {stats.etablissements === 0 && permissions.has('establishments.create') ? (
        <Alerte ton="info" titre="Commencez par créer un établissement">
          Classes, enseignants et apprenants se rattachent tous à un établissement. C&apos;est la
          première brique à poser.{' '}
          <Link href="/etablissements" className="font-medium text-primaire">
            Créer un établissement
          </Link>
        </Alerte>
      ) : null}

      <Carte>
        <CorpsCarte className="space-y-2">
          <h2 className="text-sm font-semibold text-encre">Ce qui arrive ensuite</h2>
          <p className="text-sm text-encre-douce">
            Le socle et la gestion académique sont en place : organisations, établissements,
            rôles, années, niveaux, matières, enseignants, classes, apprenants et inscriptions.
            La phase suivante apporte les présences et la notation — sessions d&apos;appel,
            évaluations, barèmes configurables et bulletins.
          </p>
        </CorpsCarte>
      </Carte>
    </div>
  );
}
