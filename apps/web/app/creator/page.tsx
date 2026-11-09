import type { Metadata } from 'next';
import { CreatorView } from '@/components/views/WalletViews';

export const metadata: Metadata = { title: 'Creator tools' };

export default function Page() {
  return <CreatorView />;
}
