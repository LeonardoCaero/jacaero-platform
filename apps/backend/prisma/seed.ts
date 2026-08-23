import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Small starting set. Add keys here as new modules gate on new permissions.
const PERMISSIONS = [
  "TIME:CREATE_OWN",
  "TIME:VIEW_OWN",
  "TIME:VIEW_ALL",
  "TIME:EDIT_ALL",
  "NOTES:CREATE",
  "CALENDAR:VIEW",
  "CALENDAR:MANAGE",
  "LEGAL:VIEW",
  "CLIENTS:MANAGE",
  "USERS:MANAGE",
  "AUDIT:VIEW",
  "ORDERS:MANAGE",
];

const EMPLOYEE_PERMISSIONS = ["TIME:CREATE_OWN", "TIME:VIEW_OWN", "NOTES:CREATE", "CALENDAR:VIEW"];

async function upsertRoleWithPermissions(name: string, keys: string[]) {
  const role = await prisma.role.upsert({
    where: { name },
    update: {},
    create: { name, isSystem: true },
  });

  const permissions = await prisma.permission.findMany({ where: { key: { in: keys } } });

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
  });

  return role;
}

async function main() {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }

  const adminRole = await upsertRoleWithPermissions("Admin", PERMISSIONS);
  await upsertRoleWithPermissions("Employee", EMPLOYEE_PERMISSIONS);

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed the admin user");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const fullName = process.env.SEED_ADMIN_FULLNAME ?? "Admin";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, fullName, roleId: adminRole.id, jobTitle: "Admin" },
    create: {
      email: adminEmail,
      passwordHash,
      fullName,
      roleId: adminRole.id,
      jobTitle: "Admin",
    },
  });

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
