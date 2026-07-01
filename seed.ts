import { db } from './src/lib/db';
import { hashPassword } from './src/lib/auth';

async function seed() {
  console.log('🌱 Seeding database...');

  // Create default admin
  const existingAdmin = await db.user.findUnique({ where: { email: 'admin@eventforge.com' } });
  if (!existingAdmin) {
    const hashedPassword = await hashPassword('admin123');
    await db.user.create({
      data: {
        name: 'System Admin',
        email: 'admin@eventforge.com',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('✅ Admin user created: admin@eventforge.com / admin123');
  } else {
    console.log('ℹ️ Admin user already exists');
  }

  // Create sample coordinator
  const existingCoord = await db.user.findUnique({ where: { email: 'coordinator@eventforge.com' } });
  if (!existingCoord) {
    const hashedPassword = await hashPassword('coord123');
    await db.user.create({
      data: {
        name: 'John Coordinator',
        email: 'coordinator@eventforge.com',
        password: hashedPassword,
        role: 'COORDINATOR',
        isActive: true,
        phone: '+91-9876543210',
        organization: 'Tech University',
      },
    });
    console.log('✅ Coordinator user created: coordinator@eventforge.com / coord123');
  }

  // Create sample evaluator
  const existingEval = await db.user.findUnique({ where: { email: 'evaluator@eventforge.com' } });
  if (!existingEval) {
    const hashedPassword = await hashPassword('eval123');
    await db.user.create({
      data: {
        name: 'Dr. Sarah Evaluator',
        email: 'evaluator@eventforge.com',
        password: hashedPassword,
        role: 'EVALUATOR',
        isActive: true,
        phone: '+91-9876543211',
        organization: 'Science College',
      },
    });
    console.log('✅ Evaluator user created: evaluator@eventforge.com / eval123');
  }

  // Create sample program
  const existingProgram = await db.program.findFirst({ where: { name: 'Quantum Fest 2026' } });
  if (!existingProgram) {
    const program = await db.program.create({
      data: {
        name: 'Quantum Fest 2026',
        description: 'Annual technical festival featuring competitions, workshops, and exhibitions',
        venue: 'Main Campus Auditorium',
        startDate: new Date('2026-03-15'),
        endDate: new Date('2026-03-17'),
        status: 'ACTIVE',
      },
    });

    // Create sample events
    const paperEvent = await db.event.create({
      data: {
        programId: program.id,
        name: 'Paper Presentation',
        description: 'Present your research papers on emerging technologies',
        venue: 'Seminar Hall A',
        eventDate: new Date('2026-03-15'),
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
        eventType: 'INDIVIDUAL',
        evaluationMode: 'STARS',
        maxStarRating: 10,
        status: 'ACTIVE',
      },
    });

    // Create evaluation criteria for paper presentation
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

    // Assign coordinator and evaluator to events
    const coordUser = await db.user.findUnique({ where: { email: 'coordinator@eventforge.com' } });
    const evalUser = await db.user.findUnique({ where: { email: 'evaluator@eventforge.com' } });

    if (coordUser && evalUser) {
      for (const event of [paperEvent, codingEvent, posterEvent]) {
        await db.eventCoordinator.create({
          data: { eventId: event.id, userId: coordUser.id },
        });
        await db.eventEvaluator.create({
          data: { eventId: event.id, userId: evalUser.id },
        });
      }

      // Create sample teams for paper presentation
      const team1 = await db.team.create({
        data: {
          eventId: paperEvent.id,
          name: 'Team Alpha',
          college: 'Tech University',
        },
      });

      const team2 = await db.team.create({
        data: {
          eventId: paperEvent.id,
          name: 'Team Beta',
          college: 'Science College',
        },
      });

      const team3 = await db.team.create({
        data: {
          eventId: paperEvent.id,
          name: 'Team Gamma',
          college: 'Engineering Institute',
        },
      });

      // Create team members
      await db.participant.createMany({
        data: [
          { eventId: paperEvent.id, teamId: team1.id, name: 'Alice Johnson', registerNumber: 'TU2024001', department: 'Computer Science', college: 'Tech University', email: 'alice@tu.edu' },
          { eventId: paperEvent.id, teamId: team1.id, name: 'Bob Smith', registerNumber: 'TU2024002', department: 'Computer Science', college: 'Tech University', email: 'bob@tu.edu' },
          { eventId: paperEvent.id, teamId: team2.id, name: 'Carol Davis', registerNumber: 'SC2024001', department: 'Electronics', college: 'Science College', email: 'carol@sc.edu' },
          { eventId: paperEvent.id, teamId: team2.id, name: 'Dan Wilson', registerNumber: 'SC2024002', department: 'Electronics', college: 'Science College', email: 'dan@sc.edu' },
          { eventId: paperEvent.id, teamId: team3.id, name: 'Eve Brown', registerNumber: 'EI2024001', department: 'Mechanical', college: 'Engineering Institute', email: 'eve@ei.edu' },
          { eventId: paperEvent.id, teamId: team3.id, name: 'Frank Lee', registerNumber: 'EI2024002', department: 'Mechanical', college: 'Engineering Institute', email: 'frank@ei.edu' },
        ],
      });

      // Create sample individual participants for coding challenge
      await db.participant.createMany({
        data: [
          { eventId: codingEvent.id, name: 'George Clark', registerNumber: 'TU2024003', department: 'Computer Science', college: 'Tech University', email: 'george@tu.edu' },
          { eventId: codingEvent.id, name: 'Hannah Martin', registerNumber: 'SC2024003', department: 'IT', college: 'Science College', email: 'hannah@sc.edu' },
          { eventId: codingEvent.id, name: 'Ivan Rodriguez', registerNumber: 'EI2024003', department: 'Computer Science', college: 'Engineering Institute', email: 'ivan@ei.edu' },
          { eventId: codingEvent.id, name: 'Julia White', registerNumber: 'TU2024004', department: 'IT', college: 'Tech University', email: 'julia@tu.edu' },
        ],
      });

      // Create sample participants for poster design
      await db.participant.createMany({
        data: [
          { eventId: posterEvent.id, name: 'Kevin Harris', registerNumber: 'TU2024005', department: 'Design', college: 'Tech University', email: 'kevin@tu.edu' },
          { eventId: posterEvent.id, name: 'Laura Thompson', registerNumber: 'SC2024004', department: 'Fine Arts', college: 'Science College', email: 'laura@sc.edu' },
          { eventId: posterEvent.id, name: 'Mike Garcia', registerNumber: 'EI2024004', department: 'Design', college: 'Engineering Institute', email: 'mike@ei.edu' },
        ],
      });

      // Create a sample evaluation
      const criteria = await db.evaluationCriteria.findMany({ where: { eventId: paperEvent.id } });
      if (criteria.length > 0) {
        const evaluation = await db.evaluation.create({
          data: {
            eventId: paperEvent.id,
            teamId: team1.id,
            evaluatorId: evalUser.id,
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
      }
    }

    console.log('✅ Sample data created');
  }

  console.log('🎉 Seeding complete!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
