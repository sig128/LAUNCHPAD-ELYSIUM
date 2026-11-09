import type { Metadata } from 'next';
import { ContractsView } from '@/components/views/InfoViews';

export const metadata: Metadata = { title: 'Contracts' };

export default function Page() {
  return <ContractsView />;
}
