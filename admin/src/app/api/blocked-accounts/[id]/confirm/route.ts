import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.API_BASE || 'http://localhost:5000'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const response = await fetch(API_BASE + '/api/blocked-accounts/' + id + '/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to confirm block:', error)
    return NextResponse.json({ success: false, error: 'Failed to confirm' }, { status: 500 })
  }
}
