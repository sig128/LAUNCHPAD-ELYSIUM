import { Suspense } from 'react';
import { DiscoverPage } from '@/components/discover/DiscoverPage';

export default function Home() {
  return (
    <Suspense fallback={<div className="panel h-96 animate-pulse" aria-busy="true" />}>
      <DiscoverPage />
    </Suspense>
  );
}
