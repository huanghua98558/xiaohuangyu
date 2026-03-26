import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTable() {
  const { data, error } = await supabase
    .from('link_verification_queue')
    .select('id, comment_author')
    .limit(1);
  
  if (error) {
    console.log('错误:', error.message);
    if (error.message.includes('column')) {
      console.log('>>> 需要添加 comment_author 字段');
    }
  } else {
    console.log('>>> comment_author 字段已存在');
  }
}

checkTable();
