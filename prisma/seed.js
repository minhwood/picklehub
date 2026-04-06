/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require("bcryptjs");
const { PrismaClient, Role, MemberStatus } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = (process.env.SEED_ADMIN_PASSWORD || "").trim();
  const memberName = (process.env.SEED_ADMIN_NAME || "Admin Owner").trim();
  const phone = (process.env.SEED_ADMIN_PHONE || "").trim();

  if (!email || !password) {
    console.log("Skipping seed. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the initial admin user.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email },
      include: { member: true },
    });

    let memberId = existingUser?.memberId || null;

    if (!memberId) {
      const member = await tx.member.create({
        data: {
          name: memberName,
          phone: phone || null,
          status: MemberStatus.ACTIVE,
        },
      });
      memberId = member.id;
    } else if (!existingUser?.member) {
      await tx.member.create({
        data: {
          id: memberId,
          name: memberName,
          phone: phone || null,
          status: MemberStatus.ACTIVE,
        },
      });
    }

    await tx.user.upsert({
      where: { email },
      update: {
        role: Role.ADMIN,
        memberId,
        passwordHash,
      },
      create: {
        email,
        passwordHash,
        role: Role.ADMIN,
        memberId,
      },
    });
  });

  console.log(`Admin user ensured: ${email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
