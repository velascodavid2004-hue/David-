import { Match, Tournament } from '../types';

/**
 * Generates a single-elimination bracket for a tournament.
 * @param participants List of boxer IDs.
 * @param tournamentId The ID of the tournament.
 * @returns An array of Match objects for the first round.
 */
export function generateInitialBracket(participants: string[], tournamentId: string): Partial<Match>[] {
  const numParticipants = participants.length;
  if (numParticipants < 2) return [];

  // Find the next power of 2
  let nextPowerOfTwo = 1;
  while (nextPowerOfTwo < numParticipants) {
    nextPowerOfTwo *= 2;
  }

  const matches: Partial<Match>[] = [];
  const round = nextPowerOfTwo / 2; // e.g., if 8 participants, round is 4 (Quarterfinals)

  // Shuffle participants for random seeding
  const shuffled = [...participants].sort(() => Math.random() - 0.5);

  for (let i = 0; i < nextPowerOfTwo; i += 2) {
    const boxer1Id = shuffled[i] || 'BYE';
    const boxer2Id = shuffled[i + 1] || 'BYE';

    const match: Partial<Match> = {
      tournamentId,
      boxer1Id,
      boxer2Id,
      round,
      matchIndex: i / 2,
      status: (boxer1Id === 'BYE' || boxer2Id === 'BYE') ? 'completed' : 'scheduled',
      scheduledDate: new Date().toISOString(),
    };

    if (boxer1Id === 'BYE') {
      match.winnerId = boxer2Id;
    } else if (boxer2Id === 'BYE') {
      match.winnerId = boxer1Id;
    }

    matches.push(match);
  }

  return matches;
}

export function getRoundName(round: number): string {
  switch (round) {
    case 1: return 'Final';
    case 2: return 'Semifinales';
    case 4: return 'Cuartos de Final';
    case 8: return 'Octavos de Final';
    default: return `Ronda de ${round * 2}`;
  }
}
