import { setRequestLocale } from 'next-intl/server';
import { Hero } from '@/components/sections/Hero';
import { About } from '@/components/sections/About';
import { ContentProduction } from '@/components/sections/ContentProduction';
import { StudioRental } from '@/components/sections/StudioRental';
import { Portfolio } from '@/components/sections/Portfolio';
import { Community } from '@/components/sections/Community';
import { Contact } from '@/components/sections/Contact';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';

export default function Home({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  return (
    <main>
      <LocaleSwitcher />
      <Hero />
      <About />
      <ContentProduction />
      <StudioRental />
      <Portfolio />
      <Community />
      <Contact />
    </main>
  );
}
