const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const notifications = await prisma.$queryRaw`
    SELECT id, type, title, created_at
    FROM admin_notifications 
    ORDER BY id DESC
    LIMIT 5
  `;
  notifications.forEach(n => {
    console.log("ID:", n.id.toString());
    console.log("  created_at:", n.created_at);
    console.log("  type:", n.created_at?.constructor?.name);
    console.log("---");
  });
  await prisma.$disconnect();
}
check().catch(console.error);
