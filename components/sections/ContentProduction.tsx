import { useTranslations } from 'next-intl';
import { RevealSection } from '@/components/ui/RevealSection';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { SectionLabel } from '@/components/ui/SectionLabel';

export function ContentProduction() {
  const t = useTranslations('contentProduction');

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-ink-soft px-6 py-24 md:px-16">
      <AmbientBackground />
      <RevealSection id="content-production" className="relative z-10 mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-center">
        <div>
          <SectionLabel number={t('label')} kicker={t('kicker')} />
          <h2 className="mb-6 text-3xl font-heading-black text-paper md:text-5xl">{t('heading')}</h2>
          <p className="text-lg leading-relaxed text-paper-dim">{t('body')}</p>
        </div>
        <div
          aria-hidden
          className="flex aspect-video items-center justify-center rounded-sm border border-ink-line bg-ink text-xs uppercase tracking-wideish text-paper-dim"
        >
          placeholder media
        </div>
      </RevealSection>
    </section>
  );
}
