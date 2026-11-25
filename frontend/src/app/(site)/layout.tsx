import { Grain } from '@/components/brand/grain';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteNav } from '@/components/layout/site-nav';

/** Marketing and reference pages. The console gets its own layout without the grain (FRONTEND_SPEC.md section 5.3). */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteNav />
      {children}
      <SiteFooter />
      <Grain />
    </>
  );
}
