import UserDetailClient from './UserDetailClient'

// 为静态导出提供generateStaticParams
export async function generateStaticParams() {
  // 返回一个占位符ID，实际运行时会动态处理
  return [{ id: '0' }]
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <UserDetailClient params={params} />
}
