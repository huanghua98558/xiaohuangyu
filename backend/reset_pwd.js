const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

const supabase = createClient(
  "https://jccjxpjzngyywyktmhur.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjY2p4cGp6bmd5eXd5a3RtaHVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDY2NDE1MSwiZXhwIjoyMDU2MjQwMTUxfQ.6i_bX2K5h1JGvLZ5y1TzxEi5IaLQK5yLPx9VU6fGnhE"
);

(async () => {
  try {
    const { data: user, error: findError } = await supabase
      .from("users")
      .select("id, username, phone, role, level, status")
      .ilike("username", "Hh123456")
      .single();
    
    if (findError || !user) {
      console.log("账号不存在");
      return;
    }
    
    console.log("找到账号:", JSON.stringify(user));
    
    const passwordHash = await bcrypt.hash("hh198752", 10);
    
    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    
    if (updateError) {
      console.log("密码重置失败:", updateError.message);
    } else {
      console.log("密码重置成功!");
      console.log("账号:", user.username);
      console.log("新密码: hh198752");
    }
  } catch (e) {
    console.log("错误:", e.message);
  }
})();
