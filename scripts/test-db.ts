
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.$connect();

  const result = await prisma.$queryRaw<
    Array<{ current_database: string }>
  >`SELECT current_database()`;

  console.log("Connected database:", result[0].current_database);
}

main()
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
