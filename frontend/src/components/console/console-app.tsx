'use client';

import * as React from 'react';
import { useConsoleData } from '@/lib/data/use-console-data';
import { env } from '@/lib/env';
import { ConsoleShell } from './console-shell';
import { SimulatedBanner } from './simulated-banner';

const CITY_VIEWPORT: Record<string, { center: [number, number]; zoom: number }> = {
  'All India': { center: [78.9629, 20.5937], zoom: 4.1 },
  Mumbai: { center: [72.8777, 19.076], zoom: 10.5 },
  Delhi: { center: [77.209, 28.6139], zoom: 10.2 },
  Bangalore: { center: [77.5946, 12.9716], zoom: 10.5 },
  Hyderabad: { center: [78.4867, 17.385], zoom: 10.5 },
  Chennai: { center: [80.2707, 13.0827], zoom: 10.5 },
  Kolkata: { center: [88.3639, 22.5726], zoom: 10.5 },
  Pune: { center: [73.8567, 18.5204], zoom: 10.5 },
  Ahmedabad: { center: [72.5714, 23.0225], zoom: 10.5 },
};

/** The console as the app route renders it: selection and city live here, the data comes from `useConsoleData()`. */
export function ConsoleApp() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [city, setCity] = React.useState('All India');
  const { data, actions } = useConsoleData(selected, city);
  const viewport = CITY_VIEWPORT[city] ?? CITY_VIEWPORT['All India']!;

  return (
    <ConsoleShell
      data={data}
      actions={actions}
      selectedDeviceId={selected}
      onSelectDevice={setSelected}
      city={city}
      onCityChange={setCity}
      mapStyleUrl={env.mapStyleUrl}
      mapCenter={viewport.center}
      mapZoom={viewport.zoom}
      banner={<SimulatedBanner city={city} />}
    />
  );
}
