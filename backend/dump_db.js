const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud',
  port: 26257,
  database: 'defaultdb',
  user: 'xiaohuanyu2',
  password: 'd5XWShrEqwWHBPxuts-gCw',
  ssl: { rejectUnauthorized: false }
});

async function dumpDatabase() {
  await client.connect();
  console.log('Connected to database');
  
  let output = '-- XiaoHuangYu Database Dump v8.0\n';
  output += '-- Generated: ' + new Date().toISOString() + '\n\n';
  
  const tablesRes = await client.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `);
  
  const tables = tablesRes.rows.map(r => r.tablename);
  console.log('Found tables:', tables.length);
  
  for (const table of tables) {
    console.log('Dumping table:', table);
    
    const schemaRes = await client.query(`
      SELECT create_statement 
      FROM crdb_internal.create_statements 
      WHERE database_name = current_database() 
      AND schema_name = 'public'
      AND name = $1
    `, [table]);
    
    if (schemaRes.rows.length > 0) {
      output += `\n-- Table: ${table}\n`;
      output += `DROP TABLE IF EXISTS ${table};\n`;
      output += schemaRes.rows[0].create_statement + ';\n\n';
    }
    
    const dataRes = await client.query(`SELECT * FROM ${table}`);
    if (dataRes.rows.length > 0) {
      const columns = dataRes.fields.map(f => f.name);
      for (const row of dataRes.rows) {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null) return 'NULL';
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'number') return val;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          return `'${val.toString().replace(/'/g, "''")}'`;
        });
        output += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
      }
      output += '\n';
    }
  }
  
  fs.writeFileSync('/tmp/xiaohuangyu_db_v8.0.sql', output);
  console.log('Dump completed!');
  await client.end();
}

dumpDatabase().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
