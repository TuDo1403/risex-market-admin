import Image from 'next/image'
import { notFound } from 'next/navigation'

import { decodeReview, type ReviewPayload } from '@/src/lib/review-link'
import { requireMarketAdminSession } from '@/src/lib/server/authz'

type ReviewPageProps = {
  params: Promise<{ token: string }>
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

  const { token } = await params
  let review: ReviewPayload
  try {
    review = decodeReview(token)
  } catch {
    notFound()
  }

  return (
    <main className="review-page">
      <section className="topbar">
        <div className="brand-lockup">
          <Image src="/icons/rise.svg" alt="" width={70} height={25} className="brand-icon" priority />
          <div>
            <p className="eyebrow">review</p>
            <h1>{review.env} market config review</h1>
          </div>
        </div>
        <span className="status-pill success">{review.createdAt}</span>
      </section>
      <section className="panel">
        <p className="panel-label">draft</p>
        <pre>{JSON.stringify(review.draft, null, 2)}</pre>
      </section>
      <section className="panel">
        <p className="panel-label">generated tx</p>
        <pre>{JSON.stringify(review.proposal, null, 2)}</pre>
      </section>
      {review.validation !== undefined && (
        <section className="panel">
          <p className="panel-label">validation</p>
          <pre>{JSON.stringify(review.validation, null, 2)}</pre>
        </section>
      )}
    </main>
  )
}
