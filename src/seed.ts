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
      },
    });
    console.log('Worker created:', worker.email);

    await prisma.field.upsert({
      where: { id: 'field-a' },
      update: {},
      create: {
        id: 'field-a',
        name: 'Field A',
        cropType: 'Sugarcane',
        warningThreshold: 10,
        criticalThreshold: 15,
      },
    });

    await prisma.field.upsert({
      where: { id: 'field-b' },
      update: {},
      create: {
        id: 'field-b',
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
