import { db } from './src/lib/db';

async function main() {
  console.log('🧹 Starting cleanup of orphaned records...');

  // 1. Delete evaluations associated with DELETED events
  const deletedEvals = await db.evaluation.deleteMany({
    where: {
      event: { status: 'DELETED' }
    }
  });
  console.log(`- Cleaned up ${deletedEvals.count} orphaned evaluations`);

  // 2. Delete teams associated with DELETED events
  const deletedTeams = await db.team.deleteMany({
    where: {
      event: { status: 'DELETED' }
    }
  });
  console.log(`- Cleaned up ${deletedTeams.count} orphaned teams`);

  // 3. Delete participants associated with DELETED events
  const deletedParticipants = await db.participant.deleteMany({
    where: {
      event: { status: 'DELETED' }
    }
  });
  console.log(`- Cleaned up ${deletedParticipants.count} orphaned participants`);

  // 4. Delete event coordinators associated with DELETED events
  const deletedCoordinators = await db.eventCoordinator.deleteMany({
    where: {
      event: { status: 'DELETED' }
    }
  });
  console.log(`- Cleaned up ${deletedCoordinators.count} orphaned coordinators`);

  // 5. Delete event evaluators associated with DELETED events
  const deletedEvaluators = await db.eventEvaluator.deleteMany({
    where: {
      event: { status: 'DELETED' }
    }
  });
  console.log(`- Cleaned up ${deletedEvaluators.count} orphaned evaluators`);

  // 6. Delete criteria associated with DELETED events
  const deletedCriteria = await db.evaluationCriteria.deleteMany({
    where: {
      event: { status: 'DELETED' }
    }
  });
  console.log(`- Cleaned up ${deletedCriteria.count} orphaned criteria`);

  // 7. Delete events associated with DELETED programs or status is DELETED
  const deletedEvents = await db.event.deleteMany({
    where: {
      OR: [
        { status: 'DELETED' },
        { program: { status: 'DELETED' } }
      ]
    }
  });
  console.log(`- Cleaned up ${deletedEvents.count} deleted events`);

  // 8. Delete programs where status is DELETED
  const deletedPrograms = await db.program.deleteMany({
    where: {
      status: 'DELETED'
    }
  });
  console.log(`- Cleaned up ${deletedPrograms.count} deleted programs`);

  console.log('🎉 Cleanup finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
