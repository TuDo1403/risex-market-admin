import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { marketDraftMachine } from './marketDraftMachine'

function startMachine() {
  const actor = createActor(marketDraftMachine)
  actor.start()
  return actor
}

describe('marketDraftMachine', () => {
  it('moves through the happy path to readyForExecution after building the atomic tx', () => {
    const actor = startMachine()

    expect(actor.getSnapshot().value).toBe('idle')

    actor.send({ type: 'SELECT_ENV', env: 'mainnet' })
    expect(actor.getSnapshot().value).toBe('loadingDeployments')

    actor.send({ type: 'DEPLOYMENTS_LOADED' })
    expect(actor.getSnapshot().value).toBe('loadingLiveMarkets')

    actor.send({ type: 'LIVE_MARKETS_LOADED', totalMarkets: 15 })
    expect(actor.getSnapshot().value).toBe('editing')

    actor.send({ type: 'SUBMIT_DRAFT' })
    expect(actor.getSnapshot().value).toBe('validating')

    actor.send({ type: 'VALIDATION_PASSED' })
    expect(actor.getSnapshot().value).toBe('buildingAtomicTx')

    actor.send({ type: 'ATOMIC_TX_BUILT' })
    expect(actor.getSnapshot().value).toBe('readyForExecution')
  })

  it('does not gate mainnet execution on shadow preflight', () => {
    const actor = startMachine()
    actor.send({ type: 'SELECT_ENV', env: 'mainnet' })
    actor.send({ type: 'DEPLOYMENTS_LOADED' })
    actor.send({ type: 'LIVE_MARKETS_LOADED', totalMarkets: 15 })
    actor.send({ type: 'SUBMIT_DRAFT' })
    actor.send({ type: 'VALIDATION_PASSED' })
    actor.send({ type: 'ATOMIC_TX_BUILT' })

    expect(actor.getSnapshot().value).toBe('readyForExecution')
  })

  it('creates review links from the ready state without backend authentication', () => {
    const actor = startMachine()
    actor.send({ type: 'SELECT_ENV', env: 'mainnet' })
    actor.send({ type: 'DEPLOYMENTS_LOADED' })
    actor.send({ type: 'LIVE_MARKETS_LOADED', totalMarkets: 15 })
    actor.send({ type: 'SUBMIT_DRAFT' })
    actor.send({ type: 'VALIDATION_PASSED' })
    actor.send({ type: 'ATOMIC_TX_BUILT' })
    actor.send({ type: 'CREATE_REVIEW_LINK' })

    expect(actor.getSnapshot().value).toBe('creatingReviewLink')
    expect(actor.getSnapshot().context.lastError).toBeUndefined()
  })

  it('does not submit a transaction before readyForExecution', () => {
    const actor = startMachine()
    actor.send({ type: 'SUBMIT_TRANSACTION' })

    expect(actor.getSnapshot().value).toBe('idle')
  })
})
