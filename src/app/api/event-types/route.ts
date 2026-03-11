// src/app/api/event-types/route.ts
// GET /api/event-types
//
// Returns active event types. The public booking page calls this endpoint.
//
// Filtering:
//   - Default (no query param): only returns event types where is_listed = true
//   - ?all=true (admin only): returns all active event types regardless of is_listed
//   - ?slug=<slug>: returns the single event type by slug regardless of is_listed
//     (needed so Priority Barbershop can deep-link to backlog-audit)
//
// The old public listing page already calls this without query params, so it will
// automatically hide any event types with is_listed = false – no changes needed there.

import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createServiceRoleClient()
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  const all = searchParams.get('all') === 'true'

  // Single event type by slug – used by both old and new booking pages
  if (slug) {
    const { data, error } = await supabase
      .from('event_types')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 404 })
    }
    return NextResponse.json(data)
  }

  // List query
  let query = supabase.from('event_types').select('*').eq('is_active', true).order('created_at')

  // Only filter by is_listed when fetching the public listing (not admin)
  if (!all) {
    query = query.eq('is_listed', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching event types:', error)
    return NextResponse.json({ error: 'Failed to fetch event types' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
