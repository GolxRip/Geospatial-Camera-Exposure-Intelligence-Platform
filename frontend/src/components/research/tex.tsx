import katex from 'katex';

/**
 * Typesets an equation at build time with KaTeX (FRONTEND_SPEC.md section 13): no client script and no third-party request.
 * The input is a string literal from this codebase, never user text. Display equations scroll sideways on narrow screens
 * and are keyboard reachable.
 */
export function Tex({
  tex,
  display = false,
  label,
}: {
  tex: string;
  display?: boolean;
  label?: string;
}) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: true,
    output: 'htmlAndMathml',
  });
  if (!display) return <span dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <div
      role="region"
      aria-label={label ?? 'Equation'}
      tabIndex={0}
      className="overflow-x-auto rounded-chip py-2 text-bone"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
