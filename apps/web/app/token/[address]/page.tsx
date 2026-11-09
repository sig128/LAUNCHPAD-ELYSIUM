import { Suspense } from 'react';
import { TokenWorkspace } from '@/components/token/TokenWorkspace';

export default async function TokenPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return (
    <Suspense fallback={<div className="panel h-[70dvh] animate-pulse" aria-busy="true" />}>
      <TokenWorkspace address={address} />
    </Suspense>
  );
}
