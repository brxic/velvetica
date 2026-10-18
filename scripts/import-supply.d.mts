import type { Pool } from 'pg'
export function classifySupply(tags: Record<string, string | undefined>): 'water' | 'food' | 'shop' | null
export function importSupply(file: string, database: Pool, minimumCount?: number): Promise<{ count: number; snapshotAt: string }>
