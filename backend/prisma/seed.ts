import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import * as bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();

  console.log('Seeding database...');

  // Clean up existing seed data (order matters — children before parents)
  await prisma.gitCommit.deleteMany({});
  await prisma.clickUpTaskLink.deleteMany({});
  await prisma.timeEntry.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});

  const adminPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const employeePassword = await bcrypt.hash('employee123', 10);

  const admin = await prisma.user.create({
    data: {
      fullName: 'System Admin',
      email: 'admin@timein.com',
      password: adminPassword,
      role: 'ADMIN',
      team: 'Management',
    },
  });

  const manager = await prisma.user.create({
    data: {
      fullName: 'Sarah Cohen',
      email: 'manager@timein.com',
      password: managerPassword,
      role: 'MANAGER',
      team: 'Backend Team',
    },
  });

  const employee1 = await prisma.user.create({
    data: {
      fullName: 'David Levy',
      email: 'david@timein.com',
      password: employeePassword,
      role: 'EMPLOYEE',
      team: 'Backend Team',
      managerId: manager.id,
    },
  });

  const employee2 = await prisma.user.create({
    data: {
      fullName: 'Maya Mizrahi',
      email: 'maya@timein.com',
      password: employeePassword,
      role: 'EMPLOYEE',
      team: 'Frontend Team',
      managerId: manager.id,
    },
  });

  const project1 = await prisma.project.create({
    data: {
      projectName: 'TimeIn Platform',
      description: 'Work hours tracking system',
      status: 'ACTIVE',
      managerId: manager.id,
      gitRepositoryUrl: 'https://github.com/org/timein',
    },
  });

  const project2 = await prisma.project.create({
    data: {
      projectName: 'Mobile App',
      description: 'Mobile version of TimeIn',
      status: 'ACTIVE',
      managerId: manager.id,
    },
  });

  const task1 = await prisma.task.create({
    data: {
      taskName: 'Build authentication module',
      description: 'JWT login, registration, role-based access',
      projectId: project1.id,
      assignedUserId: employee1.id,
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      estimatedHours: 16,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      taskName: 'Build employee dashboard',
      description: 'Daily/weekly/monthly hours summary with charts',
      projectId: project1.id,
      assignedUserId: employee2.id,
      status: 'TODO',
      priority: 'MEDIUM',
      estimatedHours: 12,
    },
  });

  await prisma.task.create({
    data: {
      taskName: 'Mobile login screen',
      description: 'Login screen for React Native app',
      projectId: project2.id,
      assignedUserId: employee2.id,
      status: 'TODO',
      priority: 'HIGH',
      estimatedHours: 8,
    },
  });

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  await prisma.timeEntry.create({
    data: {
      userId: employee1.id,
      projectId: project1.id,
      taskId: task1.id,
      date: todayDate,
      startTime: new Date(new Date(todayDate).setHours(9, 0)),
      endTime: new Date(new Date(todayDate).setHours(12, 0)),
      durationMinutes: 180,
      workType: 'DEVELOPMENT',
      description: 'Implemented JWT authentication',
      source: 'MANUAL',
      status: 'SUBMITTED',
    },
  });

  await prisma.timeEntry.create({
    data: {
      userId: employee1.id,
      projectId: project1.id,
      taskId: task1.id,
      date: yesterdayDate,
      startTime: new Date(new Date(yesterdayDate).setHours(10, 0)),
      endTime: new Date(new Date(yesterdayDate).setHours(13, 30)),
      durationMinutes: 210,
      workType: 'DEVELOPMENT',
      description: 'Role-based access control',
      source: 'MANUAL',
      status: 'SUBMITTED',
    },
  });

  await prisma.timeEntry.create({
    data: {
      userId: employee2.id,
      projectId: project1.id,
      taskId: task2.id,
      date: todayDate,
      startTime: new Date(new Date(todayDate).setHours(9, 0)),
      endTime: new Date(new Date(todayDate).setHours(11, 0)),
      durationMinutes: 120,
      workType: 'DESIGN',
      description: 'Dashboard wireframes',
      source: 'MANUAL',
      status: 'DRAFT',
    },
  });

  await prisma.$disconnect();

  console.log('\n✅ Seed completed!');
  console.log('\nUsers:');
  console.log('  Admin:    admin@timein.com    / admin123');
  console.log('  Manager:  manager@timein.com  / manager123');
  console.log('  Employee: david@timein.com    / employee123');
  console.log('  Employee: maya@timein.com     / employee123');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
