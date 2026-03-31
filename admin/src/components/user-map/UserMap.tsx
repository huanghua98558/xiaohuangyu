'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import dynamic from 'next/dynamic'
import { MapPin, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// 动态导入 react-leaflet 组件，禁用 SSR
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const CircleMarker = dynamic(
  () => import('react-leaflet').then((mod) => mod.CircleMarker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)
const Tooltip = dynamic(
  () => import('react-leaflet').then((mod) => mod.Tooltip),
  { ssr: false }
)

interface UserLocation {
  id: number
  username: string
  province: string | null
  city: string | null
  isOnline: boolean
  level: number
  role: string
}

interface CityCluster {
  city: string
  province: string
  count: number
  users: UserLocation[]
  center: [number, number]
}

// 中国主要城市坐标（用于近似定位）
const CITY_COORDINATES: Record<string, [number, number]> = {
  // 直辖市
  '北京': [39.9042, 116.4074],
  '天津': [39.3434, 117.3616],
  '上海': [31.2304, 121.4737],
  '重庆': [29.4316, 106.9123],
  
  // 省会城市
  '石家庄': [38.0428, 114.5149],
  '太原': [37.8706, 112.5489],
  '沈阳': [41.8057, 123.4315],
  '长春': [43.8171, 125.3235],
  '哈尔滨': [45.8038, 126.5340],
  '南京': [32.0603, 118.7969],
  '杭州': [30.2741, 120.1551],
  '合肥': [31.8206, 117.2272],
  '福州': [26.0745, 119.2965],
  '南昌': [28.6829, 115.8579],
  '济南': [36.6512, 117.1209],
  '郑州': [34.7466, 113.6253],
  '武汉': [30.5928, 114.3055],
  '长沙': [28.2282, 112.9388],
  '广州': [23.1291, 113.2644],
  '海口': [20.0444, 110.1999],
  '成都': [30.5728, 104.0668],
  '贵阳': [26.6470, 106.6302],
  '昆明': [25.0406, 102.7125],
  '西安': [34.3416, 108.9398],
  '兰州': [36.0611, 103.8343],
  '西宁': [36.6171, 101.7782],
  '南宁': [22.8170, 108.3665],
  '拉萨': [29.6500, 91.1409],
  '银川': [38.4872, 106.2309],
  '呼和浩特': [40.8414, 111.7519],
  '乌鲁木齐': [43.8256, 87.6168],
  
  // 其他主要城市
  '深圳': [22.5431, 114.0579],
  '大连': [38.9140, 121.6147],
  '青岛': [36.0671, 120.3826],
  '厦门': [24.4798, 118.0894],
  '宁波': [29.8683, 121.5440],
  '苏州': [31.2989, 120.5853],
  '无锡': [31.4912, 120.3119],
  '东莞': [23.0205, 113.7518],
  '佛山': [23.0218, 113.1219],
}

// 获取城市坐标
function getCityCoordinates(city: string | null, province: string | null): [number, number] {
  if (!city && !province) return [35.8617, 104.1954] // 中国地理中心
  
  // 优先匹配城市
  if (city) {
    // 尝试直接匹配
    for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
      if (city.includes(key) || key.includes(city)) {
        return coords
      }
    }
  }
  
  // 尝试省份匹配省会
  if (province) {
    const provinceCapital: Record<string, string> = {
      '北京': '北京', '天津': '天津', '上海': '上海', '重庆': '重庆',
      '河北': '石家庄', '山西': '太原', '辽宁': '沈阳', '吉林': '长春',
      '黑龙江': '哈尔滨', '江苏': '南京', '浙江': '杭州', '安徽': '合肥',
      '福建': '福州', '江西': '南昌', '山东': '济南', '河南': '郑州',
      '湖北': '武汉', '湖南': '长沙', '广东': '广州', '海南': '海口',
      '四川': '成都', '贵州': '贵阳', '云南': '昆明', '陕西': '西安',
      '甘肃': '兰州', '青海': '西宁', '广西': '南宁', '西藏': '拉萨',
      '宁夏': '银川', '内蒙古': '呼和浩特', '新疆': '乌鲁木齐',
    }
    
    const capital = provinceCapital[province]
    if (capital && CITY_COORDINATES[capital]) {
      return CITY_COORDINATES[capital]
    }
  }
  
  // 默认返回中国中心
  return [35.8617, 104.1954]
}

// 根据用户数量计算颜色
function getMarkerColor(count: number): string {
  if (count >= 10) return '#ef4444' // 红色 - 大量用户
  if (count >= 5) return '#f97316'  // 橙色 - 中等用户
  if (count >= 2) return '#eab308'  // 黄色 - 少量用户
  return '#22c55e' // 绿色 - 单个用户
}

// 根据用户数量计算半径
function getMarkerRadius(count: number): number {
  if (count >= 10) return 25
  if (count >= 5) return 20
  if (count >= 2) return 15
  return 10
}

interface UserMapProps {
  users: UserLocation[]
}

export function UserMap({ users }: UserMapProps) {
  const [clusters, setClusters] = useState<CityCluster[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // 按城市聚类用户
    const cityMap = new Map<string, CityCluster>()
    
    users.forEach(user => {
      const locationKey = user.city || user.province || '未知'
      const existing = cityMap.get(locationKey)
      
      if (existing) {
        existing.count += 1
        existing.users.push(user)
      } else {
        const coords = getCityCoordinates(user.city, user.province)
        cityMap.set(locationKey, {
          city: user.city || '',
          province: user.province || '',
          count: 1,
          users: [user],
          center: coords,
        })
      }
    })
    
    setClusters(Array.from(cityMap.values()).sort((a, b) => b.count - a.count))
  }, [users])

  if (!mounted || clusters.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[600px]">
          <div className="text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4" />
            <p>暂无用户位置数据</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="relative h-[600px]">
          {/* @ts-ignore - react-leaflet v5 类型定义问题 */}
          <MapContainer
            center={[35.8617, 104.1954]}
            zoom={4}
            minZoom={3}
            maxZoom={10}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {clusters.map((cluster, index) => (
              <CircleMarker
                key={index}
                center={cluster.center}
                pathOptions={{
                  color: getMarkerColor(cluster.count),
                  fillColor: getMarkerColor(cluster.count),
                  fillOpacity: 0.6,
                  weight: 2,
                }}
                radius={getMarkerRadius(cluster.count)}
              >
                <Popup>
                  <div className="space-y-2 min-w-[200px]">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <MapPin className="h-4 w-4" />
                      <span className="font-semibold">
                        {cluster.city || cluster.province}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>用户数：<Badge variant="secondary">{cluster.count}</Badge></span>
                    </div>
                    <div className="space-y-1 pt-2 border-t">
                      <div className="text-xs text-muted-foreground">用户列表：</div>
                      <div className="max-h-[200px] overflow-y-auto space-y-1">
                        {cluster.users.map(user => (
                          <div key={user.id} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1">
                              {user.username}
                              {user.isOnline && (
                                <Badge variant="default" className="bg-green-500 text-xs px-1">在线</Badge>
                              )}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Lv.{user.level}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Popup>
                <Tooltip>
                  <div className="text-center">
                    <div className="font-semibold">{cluster.city || cluster.province}</div>
                    <div className="text-xs">{cluster.count} 个用户</div>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
          
          {/* 图例 */}
          <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg z-[1000]">
            <div className="text-sm font-semibold mb-2">用户分布图例</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>10+ 用户</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span>5-9 用户</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span>2-4 用户</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>1 个用户</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              总用户数：<span className="font-semibold">{users.length}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              覆盖城市：<span className="font-semibold">{clusters.length}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
