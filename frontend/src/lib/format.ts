/** Number formatting shared by the content sections. Every figure shown still comes from the facts files. */
export const f3 = (x: number): string => x.toFixed(3);
export const f2 = (x: number): string => x.toFixed(2);
export const f1 = (x: number): string => x.toFixed(1);
/** 1.5258e-5 -> "1.5e-5" */
export const sci = (x: number): string =>
  x.toExponential(1).replace('e-0', 'e-').replace('e+0', 'e+');
