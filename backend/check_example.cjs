const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const tasks = await prisma.$queryRaw`
    SELECT id, title, example_images
    FROM tasks 
    ORDER BY id DESC
    LIMIT 5
  `;
  tasks.forEach(t => {
    console.log("ID:", t.id.toString());
    console.log("  title:", t.title?.substring(0, 50));
    console.log("  example_images:", t.example_images?.substring?.(0, 100) || t.example_images);
    console.log("---");
  });
  await prisma.$disconnect();
}
check().catch(console.error);
