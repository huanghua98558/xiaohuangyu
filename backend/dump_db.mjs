import { Client } from 'pg';
import fs from 'fs';

const client = new Client({
  host: 'aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud',
  port: 26257,
  database: 'defaultdb',
  user: 'xiaohuanyu2',
  password: 'd5XWShrEqwWHBPxuts-gCw',
  ssl: { rejectUnauthorized: false }
});

async function dumpDatabase() {
  console.log('Connecting to CockroachDB...');
  await client.connect();
  console.log('Connected successfully!');

  let sql = '-- XiaoHuangYu Database Dump v8.0\n';
  sql += '-- Generated: ' + new Date().toISOString() + '\n\n';

  // Get all tables
  const tablesRes = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  console.log('Found ' + tablesRes.rows.length + ' tables');

  for (const tableRow of tablesRes.rows) {
    const tableName = tableRow.tablename;
    console.log('Processing table: ' + tableName);

    // Get CREATE statement
    const schemaRes = await client.query("SELECT create_statement FROM crdb_internal.create_statements WHERE database_name = current_database() AND descriptor_name = '" + tableName + "'");
    
    if (schemaRes.rows.length > 0) {
      sql += '\n-- Table: ' + tableName + '\n';
      sql += schemaRes.rows[0].create_statement + ';\n\n';

      // Get all data
      const dataRes = await client.query('SELECT * FROM ' + tableName);
      
      if (dataRes.rows.length > 0) {
        sql += '-- Data for ' + tableName + ' (' + dataRes.rows.length + ' rows)\n';
        
        for (const row of dataRes.rows) {
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v.toString();
            if (v instanceof Date) return "'" + v.toISOString() + "'";
            const escaped = String(v).replace(/'/g, "''");
            return "'" + escaped + "'";
          });
          sql += 'INSERT INTO ' + tableName + ' VALUES (' + values.join(', ') + ');\n';
        }
        sql += '\n';
      }
    }
  }

  // Write to file
  const outputPath = '/tmp/xiaohuangyu_db_v8.0.sql';
  fs.writeFileSync(outputPath, sql);
  console.log('Database dumped to: ' + outputPath);
  
  await client.end();
  console.log('Done!');
}

dumpDatabase().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
