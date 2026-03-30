#!/usr/bin/env python3
import re

# 读取文件
with open('/var/www/xiaohuangyu/admin/src/components/data-center/DataCenter.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 找到"数据趋势"卡片的位置
old_code = '''              <div className="col-span-9 bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-slate-400 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    数据趋势
                  </h3>'''

# 今日实时曲线卡片
new_card = '''              {/* 今日实时曲线卡片 */}
              <div className="col-span-12 bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-slate-400 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-400" />
                    今日实时趋势
                    <span className="text-xs text-slate-500">(每 10 分钟更新)</span>
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                      <span className="text-xs text-slate-400">领取</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-400"></span>
                      <span className="text-xs text-slate-400">完成</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                      <span className="text-xs text-slate-400">积分</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-64">
                  {todayRealtimeData && todayRealtimeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={todayRealtimeData}>
                        <XAxis 
                          dataKey="time" 
                          stroke="#64748b"
                          fontSize={12}
                          interval="preserveStartEnd"
                        />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            borderRadius: '8px'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="claims" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          dot={false}
                          name="领取"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="completions" 
                          stroke="#22c55e" 
                          strokeWidth={2}
                          dot={false}
                          name="完成"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="pointsIssued" 
                          stroke="#f97316" 
                          strokeWidth={2}
                          dot={false}
                          name="积分"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-slate-500">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">暂无实时数据</p>
                        <p className="text-xs mt-1">等待数据推送...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 数据趋势卡片 */}
{old_code}'''

if old_code in content:
    content = content.replace(old_code, new_card.replace('{old_code}', old_code))
    print('✅ 今日实时曲线卡片已添加')
else:
    print('❌ 未找到旧代码')
    print('正在查找类似代码...')
    # 尝试找到更精确的位置
    if '数据趋势' in content:
        print('找到了"数据趋势"')
    else:
        print('未找到"数据趋势"')

# 写回文件
with open('/var/www/xiaohuangyu/admin/src/components/data-center/DataCenter.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ 前端 UI 已更新')
