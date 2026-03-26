import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ CockroachDB 连接成功\n');
    
    await client.query(`CREATE TABLE IF NOT EXISTS night_point_config (
        id SERIAL PRIMARY KEY, time_start INT DEFAULT 0, time_end INT DEFAULT 8,
        base_coefficient DECIMAL(3,2) DEFAULT 1.4, max_coefficient DECIMAL(3,2) DEFAULT 1.8,
        no_accept_bonus DECIMAL(3,2) DEFAULT 0.1, is_active BOOL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT current_timestamp(), updated_at TIMESTAMPTZ DEFAULT current_timestamp()
      )`);
    console.log('✅ night_point_config 表创建成功');
    
    await client.query(`INSERT INTO night_point_config (time_start, time_end, base_coefficient, max_coefficient, no_accept_bonus, is_active)
      VALUES (0, 8, 1.4, 1.8, 0.1, true)`);
    console.log('✅ 配置数据插入成功');
    
    await client.query(`CREATE TABLE IF NOT EXISTS online_user_coefficient_map (
        id SERIAL PRIMARY KEY, online_users_max INT NOT NULL, coefficient DECIMAL(3,2) NOT NULL,
        description VARCHAR(100), sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT current_timestamp()
      )`);
    console.log('✅ online_user_coefficient_map 表创建成功');
    
    await client.query(`INSERT INTO online_user_coefficient_map (online_users_max, coefficient, description, sort_order)
      VALUES (10, 1.75, '极少人在线，高激励', 1), (30, 1.65, '少量人在线，中高激励', 2),
        (50, 1.55, '中等在线，适度激励', 3), (100, 1.45, '较多在线，低激励', 4),
        (200, 1.40, '大量在线，基础激励', 5)`);
    console.log('✅ 系数映射数据插入成功');
    
    const result = await client.query('SELECT * FROM night_point_config WHERE is_active = TRUE');
    console.log('\n📊 当前配置数据:', JSON.stringify(result.rows, null, 2));
    
    await client.end();
    console.log('\n✅ 所有操作完成！');
  } catch (error) {
    console.error('❌ 错误:', error.message);
    await client.end();
    process.exit(1);
  }
}

main();
