'use client';

import { useLabActions } from '@/lib/data/use-lab-data';
import { LabTabs } from './lab-tabs';

/** The lab as the app route renders it: the actions come from `useLabActions()`. */
export function LabApp() {
  return <LabTabs actions={useLabActions()} />;
}
