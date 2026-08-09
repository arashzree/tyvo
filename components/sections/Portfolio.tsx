import { useTranslations } from 'next-intl';
import { RevealSection } from '@/components/ui/RevealSection';
import { SectionLabel } from '@/components/ui/SectionLabel';

type PortfolioItem = { title: string; category: string };

export function Portfolio() {
  const t = useTranslations('portfolio');
  const items = t.raw('items') as PortfolioItem[];

  return (
    <section className="relative min-h-screen bg-ink-soft px-6 py-24 md:px-16">
      <RevealSection id="portfolio" className="mx-auto max-w-6xl">
        <SectionLabel number={t('label')} kicker={t('kicker')} />
        <h2 className="mb-4 text-3xl font-heading-black text-paper md:text-5xl">{t('heading')}</h2>
        <p className="mb-12 max-w-xl text-lg leading-relaxed text-paper-dim">{t('body')}</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <div
              key={i}
              className="group flex aspect-[4/5] flex-col justify-end gap-1 rounded-sm border border-ink-line bg-ink p-4 transition-colors duration-500 hover:border-accent"
            >
              <span className="text-xs uppercase tracking-wideish text-accent">
                {item.category}
              </span>
              <span className="text-sm text-paper">{item.title}</span>
            </div>
          ))}
        </div>
      </RevealSection>
    </section>
  );
}
