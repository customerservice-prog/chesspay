import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { sql } from 'drizzle-orm'

export async function GET() {
  try {
    // Verify DB is reachable
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
    })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: 'Database unreachable' },
      { status: 503 }
    )
  }
}
