import { ReactNode } from 'react'
import AdminLayout from '../admin-layout'
import { Suspense } from 'react'
import Loading from './loading'

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <AdminLayout>
      <Suspense fallback={<Loading />}>
        {children}
      </Suspense>
    </AdminLayout>
  )
}
