import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="panel mx-auto mt-10 max-w-lg p-6 text-center">
      <h1 className="display text-[30px]">Nothing grows here</h1>
      <p className="mt-2 text-[14.5px] text-ink-2">This page does not exist. Markets live at /token/ followed by the full contract address.</p>
      <Link href="/" className="btn btn-primary mt-5">
        Back to Discover
      </Link>
    </div>
  );
}
