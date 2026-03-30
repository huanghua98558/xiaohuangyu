import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.API_BASE || 'http://localhost:5000'

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(API_BASE + '/api/blocked-accounts/stats', {
      headers: {
        Authorization: request.headers.get('authorization') || '',
      },
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch blocked accounts stats:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 })
  }
}
