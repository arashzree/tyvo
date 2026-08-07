'use client';

import { useTranslations } from 'next-intl';
import { RevealSection } from '@/components/ui/RevealSection';

/**
 * Contact / Start a Project. Form UI only per Phase 1 scope —
 * client-side "required" validation on inputs, no submission logic
 * (no fetch/mailto, no backend). Submitting is a no-op for now.
 */
export function Contact() {
  const t = useTranslations('contact');
  const f = useTranslations('contact.form');
  const footer = useTranslations('contact.footer');

  return (
    <section className="relative min-h-screen bg-ink-soft px-6 py-24 md:px-16">
      <RevealSection id="contact" className="mx-auto max-w-xl">
        <p className="mb-2 text-sm uppercase tracking-wideish text-accent">{t('kicker')}</p>
        <h2 className="mb-4 text-3xl font-bold text-paper md:text-5xl">{t('heading')}</h2>
        <p className="mb-10 text-lg leading-relaxed text-paper-dim">{t('body')}</p>

        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => e.preventDefault()}
          noValidate={false}
        >
          <Field label={f('name')} name="name" required />
          <Field label={f('contact')} name="contact" required />
          <Field label={f('projectType')} name="projectType" />
          <Field label={f('message')} name="message" as="textarea" required />

          <button
            type="submit"
            className="mt-2 self-start rounded-full bg-accent px-8 py-3 text-sm uppercase tracking-wideish text-paper transition-colors duration-300 hover:bg-accent-glow"
          >
            {f('submit')}
          </button>
        </form>
      </RevealSection>

      <footer className="mx-auto mt-24 flex max-w-xl flex-col items-center gap-4 border-t border-ink-line pt-8 text-sm text-paper-dim">
        <div className="flex gap-6">
          <a
            href="https://instagram.com/tyvomedia"
            target="_blank"
            rel="noreferrer"
            className="transition-colors duration-300 hover:text-accent"
          >
            {footer('instagram')}
          </a>
          <a
            href="https://x.com/tyvomedia"
            target="_blank"
            rel="noreferrer"
            className="transition-colors duration-300 hover:text-accent"
          >
            {footer('twitter')}
          </a>
        </div>
        <p>© {new Date().getFullYear()} TYV Media — {footer('rights')}</p>
      </footer>
    </section>
  );
}

function Field({
  label,
  name,
  required,
  as = 'input',
}: {
  label: string;
  name: string;
  required?: boolean;
  as?: 'input' | 'textarea';
}) {
  const shared =
    'w-full rounded-sm border border-ink-line bg-ink px-4 py-3 text-paper placeholder:text-paper-dim/50 focus:border-accent';

  return (
    <label className="flex flex-col gap-2 text-sm text-paper-dim">
      {label}
      {as === 'textarea' ? (
        <textarea name={name} required={required} rows={4} className={shared} />
      ) : (
        <input name={name} required={required} className={shared} />
      )}
    </label>
  );
}
