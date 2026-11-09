import type { Metadata } from 'next';
import { RewardsView } from '@/components/views/WalletViews';

export const metadata: Metadata = { title: 'Rewards' };

export default function Page() {
  return <RewardsView />;
}
