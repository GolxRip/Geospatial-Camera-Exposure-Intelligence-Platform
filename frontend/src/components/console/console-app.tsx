'use client';

import * as React from 'react';
import { useConsoleData } from '@/lib/data/use-console-data';
import { env } from '@/lib/env';
import { ConsoleShell } from './console-shell';

/** The console as the app route renders it: selection and city live here, the data comes from `useConsoleData()`. */
export function ConsoleApp() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [city, setCity] = React.useState('All India');
  const { data, actions } = useConsoleData(selected, city);
  return (
    <ConsoleShell
      data={data}
      actions={actions}
      selectedDeviceId={selected}
      onSelectDevice={setSelected}
      city={city}
      onCityChange={setCity}
      mapStyleUrl={env.mapStyleUrl}
    />
  );
}
