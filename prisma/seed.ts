import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Admin
  await prisma.user.upsert({
    where: { email: 'admin@fitroom.io' },
    update: {},
    create: { name: 'Platform Admin', email: 'admin@fitroom.io', passwordHash, role: 'ADMIN' },
  });

  // Designer user + profile
  const designerUser = await prisma.user.upsert({
    where: { email: 'designer@lagosroyale.com' },
    update: {},
    create: {
      name: 'Lagos Royale',
      email: 'designer@lagosroyale.com',
      passwordHash,
      role: 'DESIGNER',
    },
  });

  const designer = await prisma.designer.upsert({
    where: { userId: designerUser.id },
    update: {},
    create: {
      userId: designerUser.id,
      brand: 'Lagos Royale Couture',
      location: 'Lagos, NG',
      leadTime: '10-14 days',
      specialties: ['Senator', 'Kaftan', 'Agbada'],
      verificationStatus: 'VERIFIED',
    },
  });

  // Products with size charts (the prototype data)
  const existing = await prisma.product.findFirst({ where: { designerId: designer.id } });
  if (!existing) {
    await prisma.product.createMany({
      data: [
        {
          designerId: designer.id,
          title: 'Classic Senator (2pc)',
          category: 'Senator',
          fabric: 'Cotton blend',
          stretch: 'LOW',
          priceKobo: 42000 * 100,
          images: [],
          sizeChart: {
            sizes: ['S', 'M', 'L', 'XL', 'XXL'],
            chest: [96, 100, 104, 108, 112],
            waist: [84, 88, 92, 96, 100],
          },
        },
        {
          designerId: designer.id,
          title: 'Embroidered Kaftan',
          category: 'Kaftan',
          fabric: 'Guinea brocade',
          stretch: 'NONE',
          priceKobo: 55000 * 100,
          images: [],
          sizeChart: {
            sizes: ['S', 'M', 'L', 'XL', 'XXL'],
            chest: [98, 102, 106, 110, 114],
            waist: [86, 90, 94, 98, 102],
          },
        },
      ],
    });
  }

  // Sample customer (with consent) + a fit profile
  const customer = await prisma.user.upsert({
    where: { email: 'customer@demo.io' },
    update: {},
    create: {
      name: 'Tunde Bakare',
      email: 'customer@demo.io',
      passwordHash,
      role: 'CUSTOMER',
      consentBodyData: true,
    },
  });

  const hasProfile = await prisma.fitProfile.findFirst({ where: { userId: customer.id } });
  if (!hasProfile) {
    await prisma.fitProfile.create({
      data: {
        userId: customer.id,
        version: 1,
        fitPref: 'regular',
        measurements: {
          height: { val: 178, conf: 88 },
          shoulder: { val: 47, conf: 80 },
          chest: { val: 104, conf: 85 },
          waist: { val: 94, conf: 78 },
          hip: { val: 102, conf: 82 },
        },
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete. Logins (password: Password123!):');
  console.log('  admin@fitroom.io · designer@lagosroyale.com · customer@demo.io');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
