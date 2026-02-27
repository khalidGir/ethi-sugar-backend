import bcrypt from 'bcryptjs';
import prisma from './config/database';
import { Role, FertilizerType, CropPlanStatus, VerificationStatus } from './types/enums';

const seed = async () => {
  console.log('Starting seed...');

  try {
    // Create users with different roles
    const adminPassword = await bcrypt.hash('Admin123!', 10);
    const managerPassword = await bcrypt.hash('Manager123!', 10);
    const agronomistPassword = await bcrypt.hash('Agronomist123!', 10);
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

    const manager = await prisma.user.upsert({
      where: { email: 'manager@ethiosugar.local' },
      update: {},
      create: {
        email: 'manager@ethiosugar.local',
        passwordHash: managerPassword,
        fullName: 'Farm Manager',
        role: Role.MANAGER,
        telegramUsername: 'manager_ethio',
      },
    });
    console.log('Manager created:', manager.email);

    const agronomist = await prisma.user.upsert({
      where: { email: 'agronomist@ethiosugar.local' },
      update: {},
      create: {
        email: 'agronomist@ethiosugar.local',
        passwordHash: agronomistPassword,
        fullName: 'Chief Agronomist',
        role: Role.AGRONOMIST,
        telegramUsername: 'agronomist_ethio',
      },
    });
    console.log('Agronomist created:', agronomist.email);

    const worker1 = await prisma.user.upsert({
      where: { email: 'worker1@ethiosugar.local' },
      update: {},
      create: {
        email: 'worker1@ethiosugar.local',
        passwordHash: workerPassword,
        fullName: 'Farm Worker 1',
        role: Role.WORKER,
        telegramUsername: 'worker1_ethio',
      },
    });

    const worker2 = await prisma.user.upsert({
      where: { email: 'worker2@ethiosugar.local' },
      update: {},
      create: {
        email: 'worker2@ethiosugar.local',
        passwordHash: workerPassword,
        fullName: 'Farm Worker 2',
        role: Role.WORKER,
        telegramUsername: 'worker2_ethio',
      },
    });
    console.log('Workers created');

    // Create fields with enhanced data
    const fieldA = await prisma.field.upsert({
      where: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      update: {},
      create: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Field A - North',
        cropType: 'Sugarcane',
        warningThreshold: 10,
        criticalThreshold: 15,
        area: 25.5,
        coordinates: { lat: 9.0222, lng: 38.7469 },
        soilType: 'Clay Loam',
        irrigationType: 'Drip',
        plantingDate: new Date('2025-06-15'),
        cropStage: 'Vegetative',
      },
    });

    const fieldB = await prisma.field.upsert({
      where: { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' },
      update: {},
      create: {
        id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        name: 'Field B - South',
        cropType: 'Maize',
        warningThreshold: 12,
        criticalThreshold: 18,
        area: 18.0,
        coordinates: { lat: 9.0150, lng: 38.7500 },
        soilType: 'Sandy Loam',
        irrigationType: 'Sprinkler',
        plantingDate: new Date('2025-07-01'),
        cropStage: 'Flowering',
      },
    });

    const fieldC = await prisma.field.upsert({
      where: { id: 'c3d4e5f6-a7b8-9012-cdef-123456789012' },
      update: {},
      create: {
        id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
        name: 'Field C - East',
        cropType: 'Sugarcane',
        warningThreshold: 10,
        criticalThreshold: 15,
        area: 30.0,
        soilType: 'Loam',
        irrigationType: 'Flood',
      },
    });
    console.log('Fields created: Field A, Field B, Field C');

    // Create Soil Data samples
    const soilDataSamples = [
      {
        fieldId: fieldA.id,
        nitrogen: 35.5,
        phosphorus: 18.2,
        potassium: 180.0,
        pH: 6.5,
        organicMatter: 3.2,
        electricalConductivity: 1.2,
        soilType: 'Clay Loam',
        sampleDepth: 30,
        analyzedAt: new Date('2025-12-01'),
        analyzedBy: 'Ethio Soil Lab',
      },
      {
        fieldId: fieldA.id,
        nitrogen: 32.0,
        phosphorus: 15.5,
        potassium: 165.0,
        pH: 6.3,
        organicMatter: 2.8,
        analyzedAt: new Date('2025-09-01'),
        analyzedBy: 'Ethio Soil Lab',
      },
      {
        fieldId: fieldB.id,
        nitrogen: 22.0,
        phosphorus: 12.0,
        potassium: 140.0,
        pH: 5.8,
        organicMatter: 2.1,
        soilType: 'Sandy Loam',
        sampleDepth: 25,
        analyzedAt: new Date('2025-11-15'),
        analyzedBy: 'Regional Agri Lab',
      },
      {
        fieldId: fieldC.id,
        nitrogen: 45.0,
        phosphorus: 25.0,
        potassium: 220.0,
        pH: 7.0,
        organicMatter: 4.5,
        soilType: 'Loam',
        analyzedAt: new Date('2025-10-20'),
        analyzedBy: 'Ethio Soil Lab',
      },
    ];

    for (const sample of soilDataSamples) {
      await prisma.soilData.create({ data: sample });
    }
    console.log('Soil data samples created');

    // Create Weather Records (last 7 days)
    const weatherSamples = [];
    const baseDate = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);
      weatherSamples.push({
        location: 'Addis Ababa',
        latitude: 9.0222,
        longitude: 38.7469,
        temperature: 22 + Math.random() * 5,
        humidity: 45 + Math.random() * 20,
        rainfall: Math.random() > 0.7 ? Math.random() * 15 : 0,
        windSpeed: 2 + Math.random() * 5,
        windDirection: ['NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 7)],
        recordedAt: date,
      });
    }

    for (const weather of weatherSamples) {
      await prisma.weatherRecord.create({ data: weather });
    }
    console.log('Weather records created (last 7 days)');

    // Create Worker Daily Logs
    const dailyLogsSamples = [
      {
        workerId: worker1.id,
        fieldId: fieldA.id,
        activity: 'Weeding and pest inspection',
        activityType: 'MAINTENANCE',
        hoursSpent: 6.5,
        resourcesUsed: 'Hoe, pesticide spray',
        observations: 'Found minor pest activity in northeast corner',
        loggedAt: new Date(baseDate),
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedBy: manager.id,
        verifiedAt: new Date(),
      },
      {
        workerId: worker1.id,
        fieldId: fieldB.id,
        activity: 'Irrigation system check',
        activityType: 'IRRIGATION',
        hoursSpent: 4.0,
        resourcesUsed: 'Pressure gauge, wrench',
        observations: 'All sprinklers functioning properly',
        loggedAt: new Date(baseDate),
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedBy: manager.id,
        verifiedAt: new Date(),
      },
      {
        workerId: worker2.id,
        fieldId: fieldA.id,
        activity: 'Fertilizer application',
        activityType: 'FERTILIZATION',
        hoursSpent: 5.0,
        resourcesUsed: 'UREA 50kg, spreader',
        observations: 'Applied to section 1 and 2',
        loggedAt: new Date(baseDate),
        verificationStatus: VerificationStatus.PENDING,
      },
      {
        workerId: worker2.id,
        fieldId: fieldC.id,
        activity: 'Harvesting preparation',
        activityType: 'HARVEST',
        hoursSpent: 7.0,
        resourcesUsed: 'Cutting tools, containers',
        observations: 'Ready for harvest next week',
        loggedAt: new Date(baseDate),
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedBy: agronomist.id,
        verifiedAt: new Date(),
      },
    ];

    for (const log of dailyLogsSamples) {
      await prisma.workerDailyLog.create({ data: log });
    }
    console.log('Worker daily logs created');

    // Create Fertilizer Logs
    const fertilizerLogsSamples = [
      {
        fieldId: fieldA.id,
        fertilizerType: FertilizerType.UREA,
        fertilizerName: 'Urea 46-0-0',
        applicationRate: 100, // kg/hectare
        totalAmount: 2550, // kg
        cost: 15300, // ETB
        applicationMethod: 'Broadcasting',
        growthStage: 'Vegetative',
        appliedBy: agronomist.id,
        appliedAt: new Date('2025-12-10'),
        notes: 'First application for vegetative growth',
      },
      {
        fieldId: fieldB.id,
        fertilizerType: FertilizerType.DAP,
        fertilizerName: 'DAP 18-46-0',
        applicationRate: 150,
        totalAmount: 2700,
        cost: 24300,
        applicationMethod: 'Side-dressing',
        growthStage: 'Flowering',
        appliedBy: agronomist.id,
        appliedAt: new Date('2025-12-05'),
        notes: 'Phosphorus boost for flowering stage',
      },
      {
        fieldId: fieldC.id,
        fertilizerType: FertilizerType.NPS,
        fertilizerName: 'NPS 19-38-7',
        applicationRate: 120,
        totalAmount: 3600,
        cost: 28800,
        applicationMethod: 'Broadcasting',
        growthStage: 'Vegetative',
        appliedBy: agronomist.id,
        appliedAt: new Date('2025-11-20'),
        notes: 'Balanced NPS application',
      },
    ];

    for (const log of fertilizerLogsSamples) {
      await prisma.fertilizerLog.create({ data: log });
    }
    console.log('Fertilizer logs created');

    // Create Crop Plans
    const cropPlansSamples = [
      {
        fieldId: fieldA.id,
        season: '2026 BelG',
        cropType: 'Sugarcane',
        cropVariety: 'N14 - Ethiopian Variety',
        plannedArea: 25.5,
        plantedArea: 25.0,
        plantingDate: new Date('2025-06-15'),
        expectedHarvestDate: new Date('2026-06-15'),
        targetYield: 80, // tons/hectare
        budget: 500000,
        status: CropPlanStatus.IN_PROGRESS,
        createdBy: manager.id,
      },
      {
        fieldId: fieldB.id,
        season: '2026 Meher',
        cropType: 'Maize',
        cropVariety: 'BH660 - Hybrid',
        plannedArea: 18.0,
        plantedArea: 17.5,
        plantingDate: new Date('2025-07-01'),
        expectedHarvestDate: new Date('2025-11-01'),
        targetYield: 8,
        budget: 180000,
        actualCost: 165000,
        status: CropPlanStatus.IN_PROGRESS,
        createdBy: manager.id,
      },
      {
        fieldId: fieldC.id,
        season: '2026 BelG',
        cropType: 'Sugarcane',
        cropVariety: 'Co-997',
        plannedArea: 30.0,
        plantingDate: new Date('2026-03-01'),
        expectedHarvestDate: new Date('2027-03-01'),
        targetYield: 85,
        budget: 600000,
        status: CropPlanStatus.PLANNED,
        createdBy: manager.id,
      },
    ];

    for (const plan of cropPlansSamples) {
      await prisma.cropPlan.create({ data: plan });
    }
    console.log('Crop plans created');

    // Create some Tasks
    const taskSamples = [
      {
        fieldId: fieldA.id,
        assignedToId: worker1.id,
        title: 'Complete weeding section 3',
        description: 'Finish weeding the remaining section 3 of Field A',
        status: 'OPEN' as const,
        priority: 'NORMAL' as const,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        fieldId: fieldB.id,
        assignedToId: worker2.id,
        title: 'Monitor irrigation pressure',
        description: 'Check and record irrigation pressure daily',
        status: 'OPEN' as const,
        priority: 'WARNING' as const,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        fieldId: fieldC.id,
        assignedToId: worker1.id,
        title: 'Soil sampling preparation',
        description: 'Prepare field for soil sampling next week',
        status: 'COMPLETED' as const,
        priority: 'NORMAL' as const,
        completedAt: new Date(),
      },
    ];

    for (const task of taskSamples) {
      await prisma.task.create({ data: task });
    }
    console.log('Tasks created');

    // Create some Incidents
    const incidentSamples = [
      {
        fieldId: fieldA.id,
        reportedById: worker1.id,
        type: 'CROP_DISEASE' as const,
        severity: 'WARNING' as const,
        description: 'Signs of leaf spot disease detected in section 2',
        status: 'IN_PROGRESS' as const,
      },
      {
        fieldId: fieldB.id,
        reportedById: manager.id,
        type: 'IRRIGATION_FAILURE' as const,
        severity: 'CRITICAL' as const,
        description: 'Sprinkler head malfunction in zone 3',
        status: 'OPEN' as const,
      },
    ];

    for (const incident of incidentSamples) {
      await prisma.incident.create({ data: incident });
    }
    console.log('Incidents created');

    console.log('\n========================================');
    console.log('Seed completed successfully!');
    console.log('========================================');
    console.log('\nTest Credentials:');
    console.log('Admin:       admin@ethiosugar.local / Admin123!');
    console.log('Manager:     manager@ethiosugar.local / Manager123!');
    console.log('Agronomist:  agronomist@ethiosugar.local / Agronomist123!');
    console.log('Worker 1:    worker1@ethiosugar.local / Worker123!');
    console.log('Worker 2:    worker2@ethiosugar.local / Worker123!');
    console.log('\n========================================\n');
  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seed();
