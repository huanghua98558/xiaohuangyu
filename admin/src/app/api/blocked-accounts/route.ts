import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.API_BASE || 'http://localhost:5000'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status')
  const platform = searchParams.get('platform')
  const userId = searchParams.get('userId')
  const page = searchParams.get('page') || '1'
  const pageSize = searchParams.get('pageSize') || '20'

  const params = new URLSearchParams()
  if (status) params.append('status', status)
  if (platform) params.append('platform', platform)
  if (userId) params.append('userId', userId)
  params.append('page', page)
  params.append('pageSize', pageSize)

  try {
    const response = await fetch(API_BASE + '/api/blocked-accounts?' + params.toString())
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch blocked accounts:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 })
  }
}
