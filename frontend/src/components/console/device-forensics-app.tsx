'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useConsoleData } from '@/lib/data/use-console-data';
import { safeDecode } from '@/lib/utils';
import { DeviceForensics } from './device-forensics';
import { SimulatedBanner } from './simulated-banner';

/** The device route: reads the id from the URL, asks `useConsoleData()` for that device, and displays only what comes back. */
export function DeviceForensicsApp() {
  const params = useParams<{ id: string }>();
  const id = safeDecode(params.id);
  const { data, actions } = useConsoleData(id, 'All India');
  return <DeviceForensics detail={data.detail} actions={actions} banner={<SimulatedBanner />} />;
}
