import { db } from './src/lib/db';
import { hashPassword } from './src/lib/auth';

async function main() {
  console.log('🌱 Seeding Demo Program and Events...');

  // 1. Create or retrieve users
  const credentials = [
    {
      name: 'Paper Coordinator',
      email: 'paper_coordinator@eventforge.com',
      password: 'PaperCoord@123',
      role: 'COORDINATOR' as const,
    },
    {
      name: 'Paper Evaluator',
      email: 'paper_evaluator@eventforge.com',
      password: 'PaperEval@123',
      role: 'EVALUATOR' as const,
    },
    {
      name: 'Photoshop Coordinator',
      email: 'photoshop_coordinator@eventforge.com',
      password: 'PhotoCoord@123',
      role: 'COORDINATOR' as const,
    },
    {
      name: 'Photoshop Evaluator',
      email: 'photoshop_evaluator@eventforge.com',
      password: 'PhotoEval@123',
      role: 'EVALUATOR' as const,
    },
  ];

  const createdUsers: Record<string, any> = {};

  for (const cred of credentials) {
    const existingUser = await db.user.findUnique({ where: { email: cred.email } });
    if (existingUser) {
      console.log(`ℹ️ User ${cred.email} already exists.`);
      createdUsers[cred.email] = existingUser;
    } else {
      const hashedPassword = await hashPassword(cred.password);
      const user = await db.user.create({
        data: {
          name: cred.name,
          email: cred.email,
          password: hashedPassword,
          role: cred.role,
          isActive: true,
          phone: '+91-9999999999',
          organization: 'Demo University',
        },
      });
      console.log(`✅ Created User: ${cred.email} with role ${cred.role}`);
      createdUsers[cred.email] = user;
    }
  }

  // 2. Create the Program
  const programName = 'Demo Tech Fest 2026';
  let program = await db.program.findFirst({ where: { name: programName } });
  if (program) {
    console.log(`ℹ️ Program "${programName}" already exists.`);
  } else {
    program = await db.program.create({
      data: {
        name: programName,
        description: 'A demonstration program showcasing EventForge features and registration mechanisms.',
        venue: 'Exhibition Center & Seminar Hall',
        startDate: new Date(),
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Created Program: "${program.name}" (ID: ${program.id})`);
  }

  // 3. Create the two Events under this Program
  // A. Paper Presentation (Team Event)
  let paperEvent = await db.event.findFirst({
    where: { programId: program.id, name: 'Paper Presentation' },
  });
  if (paperEvent) {
    console.log(`ℹ️ Event "Paper Presentation" already exists under "${programName}".`);
  } else {
    paperEvent = await db.event.create({
      data: {
        programId: program.id,
        name: 'Paper Presentation',
        description: 'Present your research papers on emerging technologies like AI, Blockchain, and IoT.',
        venue: 'Seminar Room 101',
        eventDate: new Date(),
        eventType: 'TEAM',
        evaluationMode: 'MARKS',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Created Event: "Paper Presentation" (ID: ${paperEvent.id})`);

    // Add criteria for Paper Presentation
    await db.evaluationCriteria.createMany({
      data: [
        { eventId: paperEvent.id, name: 'Content & Research', maxMarks: 40, weightage: 40, order: 1 },
        { eventId: paperEvent.id, name: 'Delivery & Presentation', maxMarks: 30, weightage: 30, order: 2 },
        { eventId: paperEvent.id, name: 'Response to Q&A', maxMarks: 30, weightage: 30, order: 3 },
      ],
    });
    console.log(`✅ Added Evaluation Criteria for "Paper Presentation"`);
  }

  // B. Photoshop Designing (Individual Event)
  let photoEvent = await db.event.findFirst({
    where: { programId: program.id, name: 'Photoshop Designing' },
  });
  if (photoEvent) {
    console.log(`ℹ️ Event "Photoshop Designing" already exists under "${programName}".`);
  } else {
    photoEvent = await db.event.create({
      data: {
        programId: program.id,
        name: 'Photoshop Designing',
        description: 'Digital design and image manipulation contest based on a theme revealed on-spot.',
        venue: 'Computer Lab B',
        eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
        eventType: 'INDIVIDUAL',
        evaluationMode: 'MARKS',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Created Event: "Photoshop Designing" (ID: ${photoEvent.id})`);

    // Add criteria for Photoshop Designing
    await db.evaluationCriteria.createMany({
      data: [
        { eventId: photoEvent.id, name: 'Creativity & Originality', maxMarks: 40, weightage: 40, order: 1 },
        { eventId: photoEvent.id, name: 'Composition & Aesthetics', maxMarks: 30, weightage: 30, order: 2 },
        { eventId: photoEvent.id, name: 'Technical Skill & Execution', maxMarks: 30, weightage: 30, order: 3 },
      ],
    });
    console.log(`✅ Added Evaluation Criteria for "Photoshop Designing"`);
  }

  // 4. Assign Coordinators & Evaluators to Events
  // Assign Paper
  const paperCoordUser = createdUsers['paper_coordinator@eventforge.com'];
  const paperEvalUser = createdUsers['paper_evaluator@eventforge.com'];
  if (paperCoordUser && paperEvalUser) {
    const existingAssignmentCoord = await db.eventCoordinator.findUnique({
      where: { eventId_userId: { eventId: paperEvent.id, userId: paperCoordUser.id } },
    });
    if (!existingAssignmentCoord) {
      await db.eventCoordinator.create({
        data: { eventId: paperEvent.id, userId: paperCoordUser.id },
      });
      console.log(`✅ Assigned Coordinator to "Paper Presentation"`);
    }

    const existingAssignmentEval = await db.eventEvaluator.findUnique({
      where: { eventId_userId: { eventId: paperEvent.id, userId: paperEvalUser.id } },
    });
    if (!existingAssignmentEval) {
      await db.eventEvaluator.create({
        data: { eventId: paperEvent.id, userId: paperEvalUser.id },
      });
      console.log(`✅ Assigned Evaluator to "Paper Presentation"`);
    }
  }

  // Assign Photoshop
  const photoCoordUser = createdUsers['photoshop_coordinator@eventforge.com'];
  const photoEvalUser = createdUsers['photoshop_evaluator@eventforge.com'];
  if (photoCoordUser && photoEvalUser) {
    const existingAssignmentCoord = await db.eventCoordinator.findUnique({
      where: { eventId_userId: { eventId: photoEvent.id, userId: photoCoordUser.id } },
    });
    if (!existingAssignmentCoord) {
      await db.eventCoordinator.create({
        data: { eventId: photoEvent.id, userId: photoCoordUser.id },
      });
      console.log(`✅ Assigned Coordinator to "Photoshop Designing"`);
    }

    const existingAssignmentEval = await db.eventEvaluator.findUnique({
      where: { eventId_userId: { eventId: photoEvent.id, userId: photoEvalUser.id } },
    });
    if (!existingAssignmentEval) {
      await db.eventEvaluator.create({
        data: { eventId: photoEvent.id, userId: photoEvalUser.id },
      });
      console.log(`✅ Assigned Evaluator to "Photoshop Designing"`);
    }
  }

  // 5. Seed Teams and Participants for "Paper Presentation" (Team Event - 10 Participants, 5 Teams)
  const teamsData = [
    {
      name: 'Pixel Pioneers',
      college: 'Tech Institute',
      members: [
        { name: 'Arjun Mehta', registerNumber: 'REG001', department: 'Computer Science', email: 'arjun@techinst.edu' },
        { name: 'Neha Sharma', registerNumber: 'REG002', department: 'Computer Science', email: 'neha@techinst.edu' },
      ],
    },
    {
      name: 'Code Crafters',
      college: 'Science College',
      members: [
        { name: 'Rahul Verma', registerNumber: 'REG003', department: 'Information Technology', email: 'rahul@scicoll.edu' },
        { name: 'Priya Patel', registerNumber: 'REG004', department: 'Information Technology', email: 'priya@scicoll.edu' },
      ],
    },
    {
      name: 'Data Wizards',
      college: 'Engineering College',
      members: [
        { name: 'Aravind Swamy', registerNumber: 'REG005', department: 'Data Science', email: 'aravind@engcoll.edu' },
        { name: 'Shreya Ghoshal', registerNumber: 'REG006', department: 'Data Science', email: 'shreya@engcoll.edu' },
      ],
    },
    {
      name: 'Cyber Knights',
      college: 'National University',
      members: [
        { name: 'Vijay Kumar', registerNumber: 'REG007', department: 'Cyber Security', email: 'vijay@natuni.edu' },
        { name: 'Ananya Sen', registerNumber: 'REG008', department: 'Cyber Security', email: 'ananya@natuni.edu' },
      ],
    },
    {
      name: 'AI Innovators',
      college: 'Apex College',
      members: [
        { name: 'Rohan Das', registerNumber: 'REG009', department: 'Artificial Intelligence', email: 'rohan@apex.edu' },
        { name: 'Sneha Reddy', registerNumber: 'REG010', department: 'Artificial Intelligence', email: 'sneha@apex.edu' },
      ],
    },
  ];

  console.log('👥 Seeding Teams and Members for "Paper Presentation"...');
  for (const t of teamsData) {
    let team = await db.team.findFirst({
      where: { eventId: paperEvent.id, name: t.name },
    });
    if (!team) {
      team = await db.team.create({
        data: {
          eventId: paperEvent.id,
          name: t.name,
          college: t.college,
        },
      });
      console.log(`   Created Team: "${t.name}"`);
    }

    for (const m of t.members) {
      const existingParticipant = await db.participant.findFirst({
        where: { eventId: paperEvent.id, name: m.name, teamId: team.id },
      });
      if (!existingParticipant) {
        await db.participant.create({
          data: {
            eventId: paperEvent.id,
            teamId: team.id,
            name: m.name,
            registerNumber: m.registerNumber,
            department: m.department,
            college: t.college,
            email: m.email,
            contactNumber: '+91-9876543210',
          },
        });
        console.log(`     Added Team Member: ${m.name}`);
      }
    }
  }

  // 6. Seed Participants for "Photoshop Designing" (Individual Event - 10 Participants)
  const individualParticipants = [
    { name: 'Aditya Roy', registerNumber: 'PS001', department: 'Digital Arts', college: 'Design School', email: 'aditya@design.edu' },
    { name: 'Kriti Sanon', registerNumber: 'PS002', department: 'Visual Communication', college: 'Arts Academy', email: 'kriti@arts.edu' },
    { name: 'Varun Dhawan', registerNumber: 'PS003', department: 'Multimedia', college: 'Tech Institute', email: 'varun@techinst.edu' },
    { name: 'Alia Bhatt', registerNumber: 'PS004', department: 'Digital Arts', college: 'Design School', email: 'alia@design.edu' },
    { name: 'Ranbir Kapoor', registerNumber: 'PS005', department: 'Animation', college: 'Media Institute', email: 'ranbir@media.edu' },
    { name: 'Deepika Padukone', registerNumber: 'PS006', department: 'Visual Communication', college: 'Arts Academy', email: 'deepika@arts.edu' },
    { name: 'Ranveer Singh', registerNumber: 'PS007', department: 'Multimedia', college: 'Tech Institute', email: 'ranveer@techinst.edu' },
    { name: 'Siddharth Malhotra', registerNumber: 'PS008', department: 'Animation', college: 'Media Institute', email: 'sid@media.edu' },
    { name: 'Kiara Advani', registerNumber: 'PS009', department: 'Digital Arts', college: 'Design School', email: 'kiara@design.edu' },
    { name: 'Vicky Kaushal', registerNumber: 'PS010', department: 'Visual Communication', college: 'Arts Academy', email: 'vicky@arts.edu' },
  ];

  console.log('👤 Seeding Individual Participants for "Photoshop Designing"...');
  for (const p of individualParticipants) {
    const existingParticipant = await db.participant.findFirst({
      where: { eventId: photoEvent.id, name: p.name },
    });
    if (!existingParticipant) {
      await db.participant.create({
        data: {
          eventId: photoEvent.id,
          teamId: null,
          name: p.name,
          registerNumber: p.registerNumber,
          department: p.department,
          college: p.college,
          email: p.email,
          contactNumber: '+91-9876543210',
        },
      });
      console.log(`   Added Individual Participant: ${p.name}`);
    }
  }

  console.log('🎉 Demo Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error Seeding Demo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
