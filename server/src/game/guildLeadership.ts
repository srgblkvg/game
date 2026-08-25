import type { PoolClient } from 'pg';

export interface GuildLeadershipTransfer {
  guildId: number;
  currentLeaderId: number;
  newLeaderId: number;
}

function rowId(row: any, camel: string, lower: string): number {
  return Number(row?.[camel] ?? row?.[lower] ?? 0);
}

export async function transferGuildLeadershipWithClient(
  client: PoolClient,
  input: GuildLeadershipTransfer,
): Promise<void> {
  if (input.currentLeaderId === input.newLeaderId) {
    throw new Error('new guild leader must differ from current leader');
  }

  const guild = (await client.query(
    'SELECT id, leaderid FROM guilds WHERE id = $1 FOR UPDATE',
    [input.guildId],
  )).rows[0] as any;
  if (!guild || rowId(guild, 'id', 'id') !== input.guildId) {
    throw new Error('guild not found');
  }
  if (rowId(guild, 'leaderId', 'leaderid') !== input.currentLeaderId) {
    throw new Error('guild leader identity mismatch');
  }

  const members = (await client.query(
    `SELECT userid, rank FROM guild_members
     WHERE guildid = $1 AND userid IN ($2, $3)
     ORDER BY userid FOR UPDATE`,
    [input.guildId, input.currentLeaderId, input.newLeaderId],
  )).rows as any[];
  const current = members.find(member => rowId(member, 'userId', 'userid') === input.currentLeaderId);
  const successor = members.find(member => rowId(member, 'userId', 'userid') === input.newLeaderId);
  if (!current || current.rank !== 'leader') throw new Error('current guild leader membership mismatch');
  if (!successor || successor.rank === 'leader') throw new Error('successor guild membership mismatch');

  const demoted = await client.query(
    `UPDATE guild_members SET rank = 'officer'
     WHERE guildid = $1 AND userid = $2 AND rank = 'leader'`,
    [input.guildId, input.currentLeaderId],
  );
  if (demoted.rowCount !== 1) throw new Error('current guild leader update failed');

  const promoted = await client.query(
    `UPDATE guild_members SET rank = 'leader'
     WHERE guildid = $1 AND userid = $2 AND rank <> 'leader'`,
    [input.guildId, input.newLeaderId],
  );
  if (promoted.rowCount !== 1) throw new Error('new guild leader update failed');

  const guildUpdated = await client.query(
    'UPDATE guilds SET leaderid = $1 WHERE id = $2',
    [input.newLeaderId, input.guildId],
  );
  if (guildUpdated.rowCount !== 1) throw new Error('guild leader identity update failed');
}

export async function findGuildLeadershipSuccessorWithClient(
  client: PoolClient,
  guildId: number,
  currentLeaderId: number,
): Promise<number | null> {
  const successor = (await client.query(
    `SELECT gm.userid FROM guild_members gm
     JOIN users u ON gm.userid = u.id
     WHERE gm.guildid = $1 AND gm.userid <> $2
     ORDER BY CASE WHEN gm.rank = 'officer' THEN 0 ELSE 1 END,
              u.lastloginat DESC NULLS LAST, gm.userid
     LIMIT 1`,
    [guildId, currentLeaderId],
  )).rows[0] as any;
  return successor ? rowId(successor, 'userId', 'userid') : null;
}

export async function lockGuildForLeadershipWithClient(client: PoolClient, guildId: number): Promise<void> {
  const result = await client.query('SELECT id FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
  if (result.rowCount !== 1) throw new Error('guild not found');
}
