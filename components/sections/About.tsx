import { useTranslations } from 'next-intl';
import { RevealSection } from '@/components/ui/RevealSection';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { SectionLabel } from '@/components/ui/SectionLabel';

export function About() {
  const t = useTranslations('about');

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-ink px-6 py-24 md:px-16">
      <AmbientBackground />
      <RevealSection id="about" className="relative z-10 mx-auto max-w-2xl">
        <SectionLabel number={t('label')} kicker={t('kicker')} />
        <h2 className="mb-6 text-3xl font-bold text-paper md:text-5xl">{t('heading')}</h2>
        <p className="text-lg leading-relaxed text-paper-dim">{t('body')}</p>
      </RevealSection>
    </section>
  );
}
