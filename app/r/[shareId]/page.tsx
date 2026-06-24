import { notFound } from 'next/navigation'
import Image from 'next/image'

import { requireMarketAdminSession } from '@/src/lib/server/authz'
import { getReviewStore } from '@/src/lib/server/review-store'

type ReviewPageProps = {
  params: Promise<{ shareId: string }>
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const session = await requireMarketAdminSession()
  if (!session) {
    return (
      <main className="review-page">
        <section className="panel">
          <p className="panel-label">review auth</p>
          <h1>GitHub login required</h1>
          <p>Review links are visible only to authenticated GitHub users with the link.</p>
        </section>
      </main>
    )
  }

  const { shareId } = await params
  const review = await getReviewStore().getByShareId(shareId)
  if (!review || review.status === 'revoked') {
    notFound()
  }

  return (
    <main className="review-page">
      <section className="topbar">
        <div className="brand-lockup">
          <Image src="/icons/rise.svg" alt="" width={70} height={25} className="brand-icon" priority />
          <div>
            <p className="eyebrow">review/{review.shareId}</p>
            <h1>{review.env} market config review</h1>
          </div>
        </div>
        <span className="status-pill success">{review.status}</span>
      </section>
      <section className="panel">
        <p className="panel-label">draft</p>
        <pre>{JSON.stringify(review.draft, null, 2)}</pre>
      </section>
      <section className="panel">
        <p className="panel-label">generated tx</p>
        <pre>{JSON.stringify(review.generatedTx, null, 2)}</pre>
      </section>
      <section className="panel">
        <p className="panel-label">shadow result</p>
        <pre>{JSON.stringify(review.shadow, null, 2)}</pre>
      </section>
    </main>
  )
}
