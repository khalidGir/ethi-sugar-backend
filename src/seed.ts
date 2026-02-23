import bcrypt from 'bcryptjs';
import prisma from './config/database';
import { Role } from './types/enums';

const seed = async () => {
  console.log('Starting seed...');

  try {
    const adminPassword = await bcrypt.hash('Admin123!', 10);
    const supervisorPassword = await bcrypt.hash('Supervisor123!', 10);
    const workerPassword = await bcrypt.hash('Worker123!', 10);

    const admin = await prisma.user.upsert({
      where: { email: 'admin@ethiosugar.local' },
      update: {},
      create: {
        email: 'admin@ethiosugar.local',
        passwordHash: adminPassword,
        fullName: 'System Admin',
        role: Role.ADMIN,
        telegramUsername: 'Khalidblabla',
      },
    });
    console.log('Admin created:', admin.email);

    const supervisor = await prisma.user.upsert({
      where: { email: 'supervisor@ethiosugar.local' },
      update: {},
      create: {
        email: 'supervisor@ethiosugar.local',
        passwordHash: supervisorPassword,
        fullName: 'Field Supervisor',
        role: Role.SUPERVISOR,
        telegramUsername: 'imkhalu',
      },
    });
    console.log('Supervisor created:', supervisor.email);

    const worker = await prisma.user.upsert({
      where: { email: 'worker@ethiosugar.local' },
      update: {},
      create: {
        email: 'worker@ethiosugar.local',
        passwordHash: workerPassword,
        fullName: 'Farm Worker',
        role: Role.WORKER,
        telegramUsername: 'seifukasa',
      },
    });
    console.log('Worker created:', worker.email);

    await prisma.field.upsert({
      where: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      update: {},
      create: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Field A',
        cropType: 'Sugarcane',
        warningThreshold: 10,
        criticalThreshold: 15,
      },
    });

    await prisma.field.upsert({
      where: { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' },
      update: {},
      create: {
        id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        name: 'Field B',
        cropType: 'Sugarcane',
        warningThreshold: 12,
        criticalThreshold: 18,
      },
    });
    console.log('Fields created: Field A, Field B');

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seed();
