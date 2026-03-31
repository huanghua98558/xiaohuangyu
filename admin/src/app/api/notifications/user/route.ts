import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.API_BASE || 'http://localhost:5000'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get('userId')
  const unreadOnly = searchParams.get('unreadOnly')
  const page = searchParams.get('page') || '1'
  const pageSize = searchParams.get('pageSize') || '20'

  if (!userId) {
    return NextResponse.json({ success: false, error: '缺少用户ID' }, { status: 400 })
  }

  const params = new URLSearchParams()
  params.append('userId', userId)
  if (unreadOnly === 'true') params.append('unreadOnly', 'true')
  params.append('page', page)
  params.append('pageSize', pageSize)

  try {
    const response = await fetch(API_BASE + '/api/user-notifications?' + params.toString())
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch user notifications:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 })
  }
}
