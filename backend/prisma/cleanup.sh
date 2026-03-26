#!/bin/bash

echo "🧹 开始清理数据库残留文件..."

cd /Users/huanghua/Desktop/App/xiaohuangyu1/backend/prisma

# 删除备份文件
if [ -f schema.prisma.bak ]; then
  rm schema.prisma.bak
  echo "✅ 删除 schema.prisma.bak"
fi

# 删除旧迁移文件
if [ -f migration.sql ]; then
  rm migration.sql
  echo "✅ 删除 migration.sql"
fi

if [ -f migration_clean.sql ]; then
  rm migration_clean.sql
  echo "✅ 删除 migration_clean.sql"
fi

# 删除旧 prisma 子目录
if [ -d prisma ]; then
  rm -rf prisma
  echo "✅ 删除 prisma/ 目录"
fi

# 备份数据库
if [ -f dev.db ]; then
  cp dev.db dev.db.backup.$(date +%Y%m%d_%H%M%S)
  echo "✅ 数据库已备份"
fi

echo "🎉 清理完成！"
