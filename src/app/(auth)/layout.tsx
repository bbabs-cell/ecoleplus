import { GraduationCap } from 'lucide-react';
import { brand } from '@/config/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-douce bg-primaire text-primaire-contraste">
          <GraduationCap className="size-5" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-encre">{brand.name}</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="max-w-sm text-center text-xs text-encre-douce">{brand.tagline}</p>
    </main>
  );
}
