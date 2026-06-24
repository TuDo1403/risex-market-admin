import crypto from 'node:crypto'
import type { JSONValue } from 'postgres'

import type { MarketAdminEnv } from '@/src/config/deployments'
import type { MarketAdminSession } from './authz'

export type JsonObject = Record<string, unknown>

export type MarketReviewStatus = 'draft' | 'ready' | 'revoked'

export type MarketReview = {
  id: string
  shareId: string
  ownerGithubId: string
  ownerLogin: string
  env: MarketAdminEnv
  draft: JsonObject
  generatedTx: JsonObject
  validation: JsonObject
  shadow: JsonObject
  status: MarketReviewStatus
  createdAt: string
  updatedAt: string
}

export type CreateMarketReviewInput = {
  owner: MarketAdminSession
  env: MarketAdminEnv
  draft: JsonObject
  generatedTx: JsonObject
  validation: JsonObject
  shadow: JsonObject
}

export interface ReviewStore {
  create(input: CreateMarketReviewInput): Promise<MarketReview>
  listForOwner(ownerGithubId: string): Promise<MarketReview[]>
  getById(id: string): Promise<MarketReview | null>
  getByShareId(shareId: string): Promise<MarketReview | null>
  update(id: string, patch: Partial<Pick<MarketReview, 'draft' | 'generatedTx' | 'validation' | 'shadow' | 'status'>>): Promise<MarketReview | null>
}

let reviewStore: ReviewStore | null = null

export function getReviewStore(): ReviewStore {
  if (reviewStore) {
    return reviewStore
  }

  if (process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
    reviewStore = new PostgresReviewStore()
  } else {
    reviewStore = new MemoryReviewStore()
  }

  return reviewStore
}

export function resetReviewStoreForTests() {
  reviewStore = null
}

class MemoryReviewStore implements ReviewStore {
  private reviews = new Map<string, MarketReview>()

  async create(input: CreateMarketReviewInput): Promise<MarketReview> {
    const now = new Date().toISOString()
    const review: MarketReview = {
      id: crypto.randomUUID(),
      shareId: `rvw_${crypto.randomBytes(18).toString('base64url')}`,
      ownerGithubId: input.owner.githubId,
      ownerLogin: input.owner.login,
      env: input.env,
      draft: input.draft,
      generatedTx: input.generatedTx,
      validation: input.validation,
      shadow: input.shadow,
      status: 'ready',
      createdAt: now,
      updatedAt: now,
    }
    this.reviews.set(review.id, review)
    return review
  }

  async listForOwner(ownerGithubId: string): Promise<MarketReview[]> {
    return [...this.reviews.values()]
      .filter((review) => review.ownerGithubId === ownerGithubId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getById(id: string): Promise<MarketReview | null> {
    return this.reviews.get(id) ?? null
  }

  async getByShareId(shareId: string): Promise<MarketReview | null> {
    return [...this.reviews.values()].find((review) => review.shareId === shareId) ?? null
  }

  async update(
    id: string,
    patch: Partial<Pick<MarketReview, 'draft' | 'generatedTx' | 'validation' | 'shadow' | 'status'>>,
  ): Promise<MarketReview | null> {
    const current = this.reviews.get(id)
    if (!current) {
      return null
    }

    const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
    this.reviews.set(id, next)
    return next
  }
}

class PostgresReviewStore implements ReviewStore {
  private sqlPromise: Promise<import('postgres').Sql> | null = null

  async create(input: CreateMarketReviewInput): Promise<MarketReview> {
    const review = await new MemoryReviewStore().create(input)
    const sql = await this.sql()
    await sql`
      insert into market_reviews (
        id, share_id, owner_github_id, owner_login, env, draft_json, generated_tx_json,
        validation_json, shadow_json, status, created_at, updated_at
      ) values (
        ${review.id}, ${review.shareId}, ${review.ownerGithubId}, ${review.ownerLogin}, ${review.env},
        ${sql.json(toJsonValue(review.draft))}, ${sql.json(toJsonValue(review.generatedTx))}, ${sql.json(toJsonValue(review.validation))},
        ${sql.json(toJsonValue(review.shadow))}, ${review.status}, ${review.createdAt}, ${review.updatedAt}
      )
    `
    return review
  }

  async listForOwner(ownerGithubId: string): Promise<MarketReview[]> {
    const sql = await this.sql()
    const rows = await sql`select * from market_reviews where owner_github_id = ${ownerGithubId} order by created_at desc`
    return rows.map(rowToReview)
  }

  async getById(id: string): Promise<MarketReview | null> {
    const sql = await this.sql()
    const rows = await sql`select * from market_reviews where id = ${id} limit 1`
    return rows[0] ? rowToReview(rows[0]) : null
  }

  async getByShareId(shareId: string): Promise<MarketReview | null> {
    const sql = await this.sql()
    const rows = await sql`select * from market_reviews where share_id = ${shareId} limit 1`
    return rows[0] ? rowToReview(rows[0]) : null
  }

  async update(
    id: string,
    patch: Partial<Pick<MarketReview, 'draft' | 'generatedTx' | 'validation' | 'shadow' | 'status'>>,
  ): Promise<MarketReview | null> {
    const current = await this.getById(id)
    if (!current) {
      return null
    }

    const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
    const sql = await this.sql()
    await sql`
      update market_reviews set
        draft_json = ${sql.json(toJsonValue(next.draft))},
        generated_tx_json = ${sql.json(toJsonValue(next.generatedTx))},
        validation_json = ${sql.json(toJsonValue(next.validation))},
        shadow_json = ${sql.json(toJsonValue(next.shadow))},
        status = ${next.status},
        updated_at = ${next.updatedAt}
      where id = ${id}
    `
    return next
  }

  private async sql() {
    if (!this.sqlPromise) {
      this.sqlPromise = import('postgres').then(({ default: postgres }) => postgres(process.env.DATABASE_URL!))
    }
    return this.sqlPromise
  }
}

function toJsonValue(value: JsonObject): JSONValue {
  return JSON.parse(JSON.stringify(value)) as JSONValue
}

function rowToReview(row: Record<string, unknown>): MarketReview {
  return {
    id: String(row.id),
    shareId: String(row.share_id),
    ownerGithubId: String(row.owner_github_id),
    ownerLogin: String(row.owner_login),
    env: row.env as MarketAdminEnv,
    draft: row.draft_json as JsonObject,
    generatedTx: row.generated_tx_json as JsonObject,
    validation: row.validation_json as JsonObject,
    shadow: row.shadow_json as JsonObject,
    status: row.status as MarketReviewStatus,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }
}
