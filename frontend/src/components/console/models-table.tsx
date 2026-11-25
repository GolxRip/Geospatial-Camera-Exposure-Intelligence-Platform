import { facts } from '@/lib/content/facts.generated';
import { f1, f3 } from '@/lib/format';
import type { ModelScores } from '@/lib/data/types';
import { cn } from '@/lib/utils';

const CORPUS = {
  weightedAverage: facts['res.model.wa'].value,
  cveOnly: facts['res.model.advanced'].value,
  bayesian: facts['res.model.bayesian'].value,
  igdctf: facts['res.model.igdctf'].value,
} as const;

const ROWS: { key: keyof typeof CORPUS; name: string }[] = [
  { key: 'weightedAverage', name: 'Weighted average' },
  { key: 'cveOnly', name: 'CVE-only' },
  { key: 'bayesian', name: 'Bayesian log-odds' },
  { key: 'igdctf', name: 'IG-DCTF' },
];

/**
 * The four scoring models side by side for one device (FRONTEND_SPEC.md sections 10.3 and 11), plus the decayed variant when
 * the data has it. `full` adds the corpus columns (F1, precision, recall, false and missed counts) from the generated facts,
 * which describe the model on the synthetic corpus and not this device, and are labelled so.
 */
export function ModelsTable({
  models,
  full = false,
  className,
}: {
  models: ModelScores;
  full?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="region"
        aria-label="Model comparison table"
        tabIndex={0}
        className="overflow-x-auto"
      >
        <table className="w-full min-w-64 border-collapse text-sm">
          <caption className="sr-only">
            Score this device receives from each model
            {full ? ', and each model’s corpus metrics' : ''}
          </caption>
          <thead>
            <tr className="border-b border-line-strong text-left text-xs text-bone-2">
              <th scope="col" className="py-2 pr-3 font-normal">
                Model
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">
                This device
              </th>
              {full ? (
                <>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">
                    F1
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">
                    Precision
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">
                    Recall
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">
                    False alarms
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Missed
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, name }) => {
              const hero = key === 'igdctf';
              const c = CORPUS[key];
              return (
                <tr
                  key={key}
                  className={cn('border-b border-line', hero ? 'text-bone' : 'text-bone-2')}
                >
                  <th
                    scope="row"
                    className={cn('py-2 pr-3 text-left', hero ? 'font-medium' : 'font-normal')}
                  >
                    {name}
                  </th>
                  <td className="num py-2 pr-3 text-right">{f1(models[key])}</td>
                  {full ? (
                    <>
                      <td className="num py-2 pr-3 text-right">{f3(c.f1)}</td>
                      <td className="num py-2 pr-3 text-right">{f3(c.precision)}</td>
                      <td className="num py-2 pr-3 text-right">{f3(c.recall)}</td>
                      <td className="num py-2 pr-3 text-right">{c.fp}</td>
                      <td className="num py-2 text-right">{c.fn}</td>
                    </>
                  ) : null}
                </tr>
              );
            })}
            {models.decayed !== undefined ? (
              <tr className="text-bone-2">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  IG-DCTF, decayed
                </th>
                <td className="num py-2 pr-3 text-right">{f1(models.decayed)}</td>
                {full ? (
                  <td colSpan={5} className="py-2 text-right text-xs">
                    not evaluated on the corpus
                  </td>
                ) : null}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {full ? (
        <p className="text-xs text-bone-2">
          Corpus columns: synthetic corpus, n = {CORPUS.igdctf.n}, positive class fabricated. They
          describe each model, not this device.
        </p>
      ) : null}
    </div>
  );
}
