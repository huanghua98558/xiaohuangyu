
import fs from 'fs';
const env = fs.readFileSync('/var/www/xiaohuangyu/backend/.env', 'utf8');
const line = env.split(/?
/).find(v => v.startsWith('DATABASE_URL='));
process.env.DATABASE_URL = line ? line.slice('DATABASE_URL='.length) : '';
const { default: reviewConfigService } = await import('/var/www/xiaohuangyu/backend/src/services/ai/reviewConfigService.js');
const before = await reviewConfigService.getConfig();
await reviewConfigService.updateConfig({
  checks: {
    ...before.checks,
    like: true,
    favorite: true,
    follow: false,
  }
}, { adminId: 1, adminName: 'codex' });
const after = await reviewConfigService.getConfig();
console.log('BEFORE', JSON.stringify(before.checks));
console.log('AFTER', JSON.stringify(after.checks));
process.exit(0);
