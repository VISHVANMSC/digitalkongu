import { db } from './src/lib/db';
import { hashPassword } from './src/lib/auth';

async function seed() {
  console.log('🌱 Seeding database with Multi-Panel & Start Time Restriction settings...');

  // 1. Create default admin
  const existingAdmin = await db.user.findUnique({ where: { email: 'dharanesh@admin.com' } });
  let adminUser;
  if (!existingAdmin) {
    const hashedPassword = await hashPassword('admin123');
    adminUser = await db.user.create({
      data: {
        name: 'Dharanesh',
        email: 'dharanesh@admin.com',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('✅ Admin user created: dharanesh@admin.com / admin123');
  } else {
    adminUser = existingAdmin;
    console.log('ℹ️ Admin user already exists');
  }

  // 2. Create sample coordinators
  const coord1 = await db.user.upsert({
    where: { email: 'coordinator@digitalkongu.com' },
    update: {},
    create: {
      name: 'John Coordinator (Panel A)',
      email: 'coordinator@digitalkongu.com',
      password: await hashPassword('coord123'),
      role: 'COORDINATOR',
      isActive: true,
      phone: '+91-9876543210',
      organization: 'Tech University',
    },
  });
  console.log('✅ Coordinator 1 ready: coordinator@digitalkongu.com');

  const coord2 = await db.user.upsert({
    where: { email: 'coordinator2@digitalkongu.com' },
    update: {},
    create: {
      name: 'Bob Coordinator (Panel B)',
      email: 'coordinator2@digitalkongu.com',
      password: await hashPassword('coord123'),
      role: 'COORDINATOR',
      isActive: true,
      phone: '+91-9876543212',
      organization: 'Tech University',
    },
  });
  console.log('✅ Coordinator 2 ready: coordinator2@digitalkongu.com');

  // 3. Create sample evaluators
  const eval1 = await db.user.upsert({
    where: { email: 'evaluator@digitalkongu.com' },
    update: {},
    create: {
      name: 'Dr. Sarah Evaluator (Panel A)',
      email: 'evaluator@digitalkongu.com',
      password: await hashPassword('eval123'),
      role: 'EVALUATOR',
      isActive: true,
      phone: '+91-9876543211',
      organization: 'Science College',
    },
  });
  console.log('✅ Evaluator 1 ready: evaluator@digitalkongu.com');

  const eval2 = await db.user.upsert({
    where: { email: 'evaluator2@digitalkongu.com' },
    update: {},
    create: {
      name: 'Prof. Alex Evaluator (Panel B)',
      email: 'evaluator2@digitalkongu.com',
      password: await hashPassword('eval123'),
      role: 'EVALUATOR',
      isActive: true,
      phone: '+91-9876543213',
      organization: 'Science College',
    },
  });
  console.log('✅ Evaluator 2 ready: evaluator2@digitalkongu.com');

  // 4. Create sample program
  const programName = 'Quantum Fest 2026';
  let program = await db.program.findFirst({ where: { name: programName } });
  if (!program) {
    program = await db.program.create({
      data: {
        name: programName,
        description: 'Annual technical festival featuring competitions, workshops, and exhibitions',
        venue: 'Main Campus Auditorium',
        startDate: new Date('2026-03-15'),
        endDate: new Date('2026-03-17'),
        status: 'ACTIVE',
      },
    });
    console.log('✅ Program created: Quantum Fest 2026');
  }

  // Clear existing events/panels under this program to ensure clean seeding
  const existingEvents = await db.event.findMany({ where: { programId: program.id } });
  for (const e of existingEvents) {
    await db.event.delete({ where: { id: e.id } });
  }
  console.log('🧹 Cleaned up old program events');

  // 5. Create sample events
  const paperEvent = await db.event.create({
    data: {
      programId: program.id,
      name: 'Paper Presentation',
      description: 'Present your research papers on emerging technologies',
      venue: 'Seminar Hall A',
      eventDate: new Date('2026-03-15'),
      evaluationStart: new Date(Date.now() - 3600000), // Started 1 hour ago
      eventType: 'TEAM',
      evaluationMode: 'MARKS',
      status: 'ACTIVE',
    },
  });

  const codingEvent = await db.event.create({
    data: {
      programId: program.id,
      name: 'Coding Challenge',
      description: 'Competitive programming contest',
      venue: 'Computer Lab 1',
      eventDate: new Date('2026-03-16'),
      evaluationStart: new Date(Date.now() + 3600000 * 24), // Starts 1 day from now
      eventType: 'INDIVIDUAL',
      evaluationMode: 'STARS',
      maxStarRating: 5,
      status: 'ACTIVE',
    },
  });

  const posterEvent = await db.event.create({
    data: {
      programId: program.id,
      name: 'Poster Design',
      description: 'Creative poster design competition',
      venue: 'Exhibition Hall',
      eventDate: new Date('2026-03-17'),
      evaluationStart: new Date(Date.now() - 3600000 * 5), // Started 5 hours ago
      eventType: 'INDIVIDUAL',
      evaluationMode: 'STARS',
      maxStarRating: 10,
      status: 'ACTIVE',
    },
  });
  console.log('✅ Events created (Paper: started, Coding: future, Poster: started)');

  // 6. Create evaluation criteria for paper presentation
  await db.evaluationCriteria.createMany({
    data: [
      { eventId: paperEvent.id, name: 'Content Quality', maxMarks: 30, weightage: 30, order: 1 },
      { eventId: paperEvent.id, name: 'Innovation', maxMarks: 20, weightage: 20, order: 2 },
      { eventId: paperEvent.id, name: 'Presentation Skills', maxMarks: 20, weightage: 20, order: 3 },
      { eventId: paperEvent.id, name: 'Technical Knowledge', maxMarks: 20, weightage: 20, order: 4 },
      { eventId: paperEvent.id, name: 'Q&A Performance', maxMarks: 10, weightage: 10, order: 5 },
    ],
  });

  // Create evaluation criteria for coding challenge
  await db.evaluationCriteria.createMany({
    data: [
      { eventId: codingEvent.id, name: 'Code Efficiency', maxMarks: 25, maxStars: 5, weightage: 25, order: 1 },
      { eventId: codingEvent.id, name: 'Problem Solving', maxMarks: 25, maxStars: 5, weightage: 25, order: 2 },
      { eventId: codingEvent.id, name: 'Code Quality', maxMarks: 25, maxStars: 5, weightage: 25, order: 3 },
      { eventId: codingEvent.id, name: 'Speed', maxMarks: 25, maxStars: 5, weightage: 25, order: 4 },
    ],
  });

  // Create evaluation criteria for poster design
  await db.evaluationCriteria.createMany({
    data: [
      { eventId: posterEvent.id, name: 'Creativity', maxMarks: 30, maxStars: 10, weightage: 30, order: 1 },
      { eventId: posterEvent.id, name: 'Visual Impact', maxMarks: 25, maxStars: 10, weightage: 25, order: 2 },
      { eventId: posterEvent.id, name: 'Theme Relevance', maxMarks: 25, maxStars: 10, weightage: 25, order: 3 },
      { eventId: posterEvent.id, name: 'Technical Execution', maxMarks: 20, maxStars: 10, weightage: 20, order: 4 },
    ],
  });
  console.log('✅ Criteria seeded');

  // 7. Create Panels for Paper Presentation
  const panelA = await db.panel.create({
    data: {
      eventId: paperEvent.id,
      name: 'Panel A',
      coordinators: { create: { userId: coord1.id } },
      evaluators: { create: { userId: eval1.id } },
    },
  });

  const panelB = await db.panel.create({
    data: {
      eventId: paperEvent.id,
      name: 'Panel B',
      coordinators: { create: { userId: coord2.id } },
      evaluators: { create: { userId: eval2.id } },
    },
  });
  console.log('✅ Panels created: Panel A and Panel B for Paper Presentation');

  // Fallback Event Coordinators/Evaluators for events without panels
  await db.eventCoordinator.create({ data: { eventId: codingEvent.id, userId: coord1.id } });
  await db.eventEvaluator.create({ data: { eventId: codingEvent.id, userId: eval1.id } });
  await db.eventCoordinator.create({ data: { eventId: posterEvent.id, userId: coord1.id } });
  await db.eventEvaluator.create({ data: { eventId: posterEvent.id, userId: eval1.id } });

  // 8. Create sample Teams and Participants assigned to panels
  // Team 1 and 2 -> Panel A
  const team1 = await db.team.create({
    data: {
      eventId: paperEvent.id,
      name: 'Team Alpha',
      college: 'Tech University',
      panelId: panelA.id,
    },
  });

  const team2 = await db.team.create({
    data: {
      eventId: paperEvent.id,
      name: 'Team Beta',
      college: 'Science College',
      panelId: panelA.id,
    },
  });

  // Team 3 -> Panel B
  const team3 = await db.team.create({
    data: {
      eventId: paperEvent.id,
      name: 'Team Gamma',
      college: 'Engineering Institute',
      panelId: panelB.id,
    },
  });

  // Create team members & set their panelId
  await db.participant.createMany({
    data: [
      { eventId: paperEvent.id, teamId: team1.id, name: 'Alice Johnson', registerNumber: 'TU2024001', department: 'Computer Science', college: 'Tech University', email: 'alice@tu.edu', panelId: panelA.id },
      { eventId: paperEvent.id, teamId: team1.id, name: 'Bob Smith', registerNumber: 'TU2024002', department: 'Computer Science', college: 'Tech University', email: 'bob@tu.edu', panelId: panelA.id },
      { eventId: paperEvent.id, teamId: team2.id, name: 'Carol Davis', registerNumber: 'SC2024001', department: 'Electronics', college: 'Science College', email: 'carol@sc.edu', panelId: panelA.id },
      { eventId: paperEvent.id, teamId: team2.id, name: 'Dan Wilson', registerNumber: 'SC2024002', department: 'Electronics', college: 'Science College', email: 'dan@sc.edu', panelId: panelA.id },
      { eventId: paperEvent.id, teamId: team3.id, name: 'Eve Brown', registerNumber: 'EI2024001', department: 'Mechanical', college: 'Engineering Institute', email: 'eve@ei.edu', panelId: panelB.id },
      { eventId: paperEvent.id, teamId: team3.id, name: 'Frank Lee', registerNumber: 'EI2024002', department: 'Mechanical', college: 'Engineering Institute', email: 'frank@ei.edu', panelId: panelB.id },
    ],
  });
  console.log('✅ Teams and participants assigned to Panel A & Panel B');

  // Create individual participants for Coding Challenge (Panel-less for now, event-level)
  await db.participant.createMany({
    data: [
      { eventId: codingEvent.id, name: 'George Clark', registerNumber: 'TU2024003', department: 'Computer Science', college: 'Tech University', email: 'george@tu.edu' },
      { eventId: codingEvent.id, name: 'Hannah Martin', registerNumber: 'SC2024003', department: 'IT', college: 'Science College', email: 'hannah@sc.edu' },
    ],
  });

  // Create individual participants for Poster Design
  await db.participant.createMany({
    data: [
      { eventId: posterEvent.id, name: 'Kevin Harris', registerNumber: 'TU2024005', department: 'Design', college: 'Tech University', email: 'kevin@tu.edu' },
      { eventId: posterEvent.id, name: 'Laura Thompson', registerNumber: 'SC2024004', department: 'Fine Arts', college: 'Science College', email: 'laura@sc.edu' },
    ],
  });

  // 9. Create a sample evaluation under Panel A
  const criteria = await db.evaluationCriteria.findMany({ where: { eventId: paperEvent.id } });
  if (criteria.length > 0) {
    const evaluation = await db.evaluation.create({
      data: {
        eventId: paperEvent.id,
        teamId: team1.id,
        evaluatorId: eval1.id,
        panelId: panelA.id,
        status: 'SUBMITTED',
        totalScore: 85,
        comments: 'Excellent presentation with strong technical content',
        submittedAt: new Date(),
      },
    });

    await db.evaluationScore.createMany({
      data: [
        { evaluationId: evaluation.id, criteriaId: criteria[0].id, score: 26, starRating: 4 },
        { evaluationId: evaluation.id, criteriaId: criteria[1].id, score: 18, starRating: 4 },
        { evaluationId: evaluation.id, criteriaId: criteria[2].id, score: 16, starRating: 4 },
        { evaluationId: evaluation.id, criteriaId: criteria[3].id, score: 17, starRating: 4 },
        { evaluationId: evaluation.id, criteriaId: criteria[4].id, score: 8, starRating: 4 },
      ],
    });
    console.log('✅ Seeding completed successfully!');
  }
}

seed()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
