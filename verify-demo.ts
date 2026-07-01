import { db } from './src/lib/db';

async function main() {
  console.log('🔍 Verifying seeded data...');

  const program = await db.program.findFirst({
    where: { name: 'Demo Tech Fest 2026' },
    include: {
      events: {
        include: {
          coordinators: { include: { user: true } },
          evaluators: { include: { user: true } },
          teams: { include: { members: true } },
          participants: true,
        }
      }
    }
  });

  if (!program) {
    console.error('❌ Program "Demo Tech Fest 2026" not found!');
    process.exit(1);
  }

  console.log(`✅ Program Found: "${program.name}"`);
  console.log(`   Description: ${program.description}`);
  console.log(`   Venue: ${program.venue}`);
  console.log(`   Events Count: ${program.events.length}`);

  for (const event of program.events) {
    console.log(`\n🔹 Event: "${event.name}" (${event.eventType})`);
    console.log(`   Coordinators: ${event.coordinators.map(c => c.user.email).join(', ')}`);
    console.log(`   Evaluators: ${event.evaluators.map(e => e.user.email).join(', ')}`);
    
    if (event.eventType === 'TEAM') {
      console.log(`   Teams Count: ${event.teams.length}`);
      let totalMembers = 0;
      for (const team of event.teams) {
        console.log(`     - Team: "${team.name}" (${team.college})`);
        console.log(`       Members: ${team.members.map(m => m.name).join(', ')}`);
        totalMembers += team.members.length;
      }
      console.log(`   Total Participants: ${totalMembers}`);
    } else {
      console.log(`   Individual Participants Count: ${event.participants.length}`);
      console.log(`   Participants: ${event.participants.map(p => p.name).join(', ')}`);
    }
  }

  console.log('\n🎉 Verification completed successfully!');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
