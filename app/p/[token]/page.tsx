import { Suspense } from 'react';
import ProposalView from './view';

async function Inner({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ProposalView token={token} />;
}

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<main className="pub"><div className="pubbody">Loading your proposal…</div></main>}>
      <Inner params={params} />
    </Suspense>
  );
}
