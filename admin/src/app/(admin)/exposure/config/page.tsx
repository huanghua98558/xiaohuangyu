import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ExposureConfigPage() {
  redirect('/task-claim-config')

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>曝光配置已迁移</CardTitle>
          <CardDescription>请前往统一的任务领取配置页面维护曝光策略。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/task-claim-config">前往任务领取配置</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
