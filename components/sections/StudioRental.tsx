import { useTranslations } from 'next-intl';
import { RevealSection } from '@/components/ui/RevealSection';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { SectionLabel } from '@/components/ui/SectionLabel';

export function StudioRental() {
  const t = useTranslations('studioRental');
  const highlights = t.raw('highlights') as string[];

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-ink px-6 py-24 md:px-16">
      <AmbientBackground />
      <RevealSection id="studio-rental" className="relative z-10 mx-auto max-w-2xl">
        <SectionLabel number={t('label')} kicker={t('kicker')} />
        <h2 className="mb-6 text-3xl font-heading-black text-paper md:text-5xl">{t('heading')}</h2>
        <p className="mb-8 text-lg leading-relaxed text-paper-dim">{t('body')}</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {highlights.map((item) => (
            <li
              key={item}
              className="rounded-sm border border-ink-line px-4 py-3 text-center text-sm text-paper-dim"
            >
              {item}
            </li>
          ))}
        </ul>
      </RevealSection>
    </section>
  );
}
