import type { Metadata } from 'next';
import { LabApp } from '@/components/lab/lab-app';
import { DemoTag } from '@/components/ui/demo-tag';

export const metadata: Metadata = { title: 'Lab' };

/** Lab (FRONTEND_SPEC.md section 12): every instrument is demo-labelled. */
export default function LabPage() {
  return (
    <main id="main" className="page-container pb-24 pt-24">
      <div className="mb-10 flex flex-wrap items-center gap-4 md:mb-14">
        <h1 className="text-h2">Lab</h1>
        <DemoTag />
      </div>
      <LabApp />
    </main>
  );
}
