import type { Metadata } from 'next';
import { repoFileUrl } from '@/lib/env';

export const metadata: Metadata = { title: 'Ethics and scope' };

const IN_SCOPE = [
  'Public scanner metadata: banners and port states from services such as Shodan and Censys, queried passively.',
  'Public vulnerability catalogs: NVD entries and the CISA Known Exploited Vulnerabilities list.',
  'Public WHOIS and allocation records, used only to sort owners into broad categories.',
  'Pre-authorized recorded footage and public benchmark datasets, never live streams.',
  'Synthetic, labeled evaluation data.',
];

const OUT_OF_SCOPE = [
  'Interception of live video from discovered cameras.',
  'Credential guessing, exploitation or any penetration test against a device.',
  'Personal data about citizens, including face recognition and license plate recognition.',
  'Probing private networks.',
];

const MITIGATIONS = [
  'Ingestion and verdict endpoints require an API key.',
  'Per-camera rate limits stop automated reconnaissance.',
  'Every decision is hashed into a Merkle-chained audit ledger with an external anchor, so an operator cannot quietly rewrite history.',
  'Unpatched critical vulnerabilities (CVSS 9.0 or higher) found during scans are reported to CERT-In and the city administration before they are made public.',
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 flex flex-col gap-6">
      <h2 id={`${id}-title`} className="text-3xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-body measure text-bone-2">{children}</p>
);
const List = ({ items }: { items: string[] }) => (
  <ul className="flex flex-col gap-3">
    {items.map((i) => (
      <li key={i} className="text-body measure border-l-2 border-line-strong pl-4 text-bone-2">
        {i}
      </li>
    ))}
  </ul>
);

/**
 * Ethics and scope (FRONTEND_SPEC.md section 13). The text is condensed from ETHICS_AND_SCOPE_POLICY.md and the claim ledger
 * (paper/CLAIMS.md, claim C15); the policy file stays the source of truth.
 */
export default function EthicsPage() {
  return (
    <main id="main" className="page-container pb-24 pt-24">
      <h1 className="text-display mb-12 md:mb-16">Ethics and scope</h1>
      <div className="flex flex-col gap-20">
        <Section id="policy" title="Policy">
          <P>
            COBRA-WATCH is a research and civic-transparency platform. It measures how reliable the
            alerts from public surveillance cameras are, before anyone is dispatched. It works from
            public metadata and public catalogs, and it does not touch the cameras themselves.
          </P>
          <P>
            The video module runs only on local, pre-authorized recordings. It is decoupled from
            network discovery, and it rejects live stream addresses from public devices.
          </P>
          <a
            href={repoFileUrl('ETHICS_AND_SCOPE_POLICY.md')}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start rounded-chip text-bone underline underline-offset-4 transition-surface hover:text-signal"
          >
            Read the full policy
          </a>
        </Section>

        <Section id="scope" title="Scope">
          <div className="grid gap-10 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold tracking-tight">In scope</h3>
              <List items={IN_SCOPE} />
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold tracking-tight">Out of scope</h3>
              <List items={OUT_OF_SCOPE} />
            </div>
          </div>
        </Section>

        <Section id="legal" title="Legal framework">
          <P>
            The project follows Indian law. Under the Digital Personal Data Protection Act, 2023 it
            stores only device address, manufacturer, port and security posture, and no personal
            data of citizens. Under the Information Technology Act, 2000 (sections 43 and 66) it
            performs no unauthorized access, port manipulation or penetration testing against
            third-party systems.
          </P>
          <P>
            It applies the privacy test of Justice K.S. Puttaswamy v. Union of India (2017):
            legality, necessity and proportionality. The necessity argument is that insecure cameras
            can be recruited into botnets and used against the privacy of citizens and against
            critical infrastructure.
          </P>
        </Section>

        <Section id="dual-use" title="Dual-use mitigations">
          <P>
            A map of weak cameras helps defenders and could help attackers. The platform
            acknowledges that and reduces it by design.
          </P>
          <List items={MITIGATIONS} />
        </Section>

        <Section id="heartbeat" title="The active heartbeat gap">
          <P>
            The scoring path is passive: it uses stored scanner metadata only. The repository also
            contains a heartbeat service (<code>backend/services/heartbeat_service.py</code>, routes
            under <code>/api/heartbeat</code>) that opens TCP connections to device addresses on
            ports 80, 554 and 8080. It is not part of scoring, and this interface does not expose
            it.
          </P>
          <P>
            It still exists, so the claim that no packet is ever sent to a discovered device is not
            true of the repository as a whole. Whether to remove it or restrict it to an allowlist
            is an open decision (claim C15 in the claim ledger).
          </P>
        </Section>
      </div>
    </main>
  );
}
