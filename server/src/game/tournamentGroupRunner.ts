import {
  createFixedPlayoffPairs,
  createRoundRobinMatches,
  drawTournamentGroups,
  getGroupQualificationState,
  type RandomSource,
} from './tournamentGroupStage';

export interface GroupFightMetadata {
  stage: 'group' | 'tiebreak';
  groupName: string;
  seriesIndex: number;
}

export interface TournamentGroupRunnerInput {
  userIds: number[];
  rng?: RandomSource;
  fight: (
    player1Id: number,
    player2Id: number,
    metadata: GroupFightMetadata,
  ) => Promise<number>;
}

export interface TournamentGroupRunnerResult {
  playoffPairs: Array<[number, number]>;
}

async function bestOfFive(
  player1Id: number,
  player2Id: number,
  groupName: string,
  fight: TournamentGroupRunnerInput['fight'],
): Promise<number> {
  let player1Wins = 0;
  let player2Wins = 0;
  for (let seriesIndex = 1; player1Wins < 3 && player2Wins < 3; seriesIndex++) {
    const winnerId = await fight(player1Id, player2Id, { stage: 'tiebreak', groupName, seriesIndex });
    if (winnerId === player1Id) player1Wins++;
    else if (winnerId === player2Id) player2Wins++;
    else throw new Error(`Победитель ${winnerId} не участвовал в серии`);
  }
  return player1Wins === 3 ? player1Id : player2Id;
}

async function selectTiedQualifiers(
  tiedIds: number[],
  slots: number,
  groupName: string,
  fight: TournamentGroupRunnerInput['fight'],
): Promise<number[]> {
  let remaining = [...tiedIds];
  const selected: number[] = [];
  while (selected.length < slots && remaining.length > 0) {
    if (remaining.length === 1) {
      selected.push(remaining[0]!);
      break;
    }
    const championCandidates = [...remaining];
    let champion = championCandidates.shift()!;
    for (const candidate of championCandidates) {
      champion = await bestOfFive(champion, candidate, groupName, fight);
    }
    selected.push(champion);
    remaining = remaining.filter(userId => userId !== champion);
  }
  return selected;
}

export async function runTournamentGroupStage(
  input: TournamentGroupRunnerInput,
): Promise<TournamentGroupRunnerResult> {
  if (input.userIds.length <= 8) throw new Error('Групповой этап требует больше восьми участников');
  const groups = drawTournamentGroups(input.userIds, input.rng || Math.random);
  const qualifiers: Array<{ groupName: string; firstId: number; secondId: number }> = [];

  for (const group of groups) {
    const results: Array<{ player1Id: number; player2Id: number; winnerId: number }> = [];
    for (const match of createRoundRobinMatches(group.name, group.userIds)) {
      const winnerId = await input.fight(match.player1Id, match.player2Id, {
        stage: 'group',
        groupName: group.name,
        seriesIndex: 0,
      });
      results.push({ player1Id: match.player1Id, player2Id: match.player2Id, winnerId });
    }

    const qualification = getGroupQualificationState(group.userIds, results);
    const qualifiedIds = [...qualification.qualifiedIds];
    if (qualification.slots > 0) {
      qualifiedIds.push(...await selectTiedQualifiers(
        qualification.tiedIds,
        qualification.slots,
        group.name,
        input.fight,
      ));
    }
    if (qualifiedIds.length !== 2) throw new Error(`Группа ${group.name} не определила двух участников`);
    qualifiers.push({ groupName: group.name, firstId: qualifiedIds[0]!, secondId: qualifiedIds[1]! });
  }

  return { playoffPairs: createFixedPlayoffPairs(qualifiers) };
}
