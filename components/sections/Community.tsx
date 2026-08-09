import { useTranslations } from 'next-intl';
import { RevealSection } from '@/components/ui/RevealSection';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { SectionLabel } from '@/components/ui/SectionLabel';

export function Community() {
  const t = useTranslations('community');

  return (
    <section className="relative flex min-h-[70vh] items-center overflow-hidden bg-ink px-6 py-24 md:px-16">
      <AmbientBackground />
      <RevealSection id="community" className="relative z-10 mx-auto max-w-2xl">
        <SectionLabel number={t('label')} kicker={t('kicker')} />
        <h2 className="mb-6 text-3xl font-heading-black text-paper md:text-5xl">{t('heading')}</h2>
        <p className="text-lg leading-relaxed text-paper-dim">{t('body')}</p>
      </RevealSection>
    </section>
  );
}
