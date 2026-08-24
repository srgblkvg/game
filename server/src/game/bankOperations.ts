import type { PoolClient } from 'pg';
import { changeTreasuryWithClient } from './treasury';

const BANK_COMMISSION_RATE = 0.02;

export interface BankDepositResult {
  money: number;
  bank: number;
  commission: number;
  deposited: number;
}

export interface BankTransferResult {
  bank: number;
  targetUsername: string;
  commission: number;
  receivedAmount: number;
}

function generateAccountNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let accountNumber = '';
  for (let index = 0; index < 6; index++) {
    accountNumber += chars[Math.floor(Math.random() * chars.length)];
  }
  return accountNumber;
}

export async function depositWithClient(
  client: PoolClient,
  userId: number,
  amount: number,
): Promise<BankDepositResult> {
  const commission = Math.ceil(amount * BANK_COMMISSION_RATE);
  const deposited = amount - commission;

  await client.query('SELECT amount FROM castle_treasury WHERE id = 1 FOR UPDATE');
  const user = (await client.query(
    'SELECT money FROM users WHERE id = $1 FOR UPDATE',
    [userId],
  )).rows[0] as any;
  if (!user) throw new Error('User not found');
  if (user.money < amount) {
    throw new Error(`Недостаточно серебра. Нужно ${amount}, есть ${user.money}`);
  }

  await client.query(
    'UPDATE users SET money = money - $1, bank = bank + $2 WHERE id = $3',
    [amount, deposited, userId],
  );
  await client.query(
    'INSERT INTO bank_operations (userId, type, amount, commission, result) VALUES ($1, $2, $3, $4, $5)',
    [userId, 'deposit', amount, commission, deposited],
  );
  await changeTreasuryWithClient(client, commission, 'bank_deposit');

  const updated = (await client.query(
    'SELECT money, bank FROM users WHERE id = $1',
    [userId],
  )).rows[0] as any;
  return { money: updated.money, bank: updated.bank, commission, deposited };
}

export async function transferWithClient(
  client: PoolClient,
  userId: number,
  accountNumber: string,
  transferAmount: number,
): Promise<BankTransferResult> {
  const targetLookup = (await client.query(
    'SELECT id FROM users WHERE accountNumber = $1',
    [accountNumber],
  )).rows[0] as any;
  if (!targetLookup) throw new Error('Счёт не найден');
  if (targetLookup.id === userId) throw new Error('Нельзя перевести самому себе');

  await client.query('SELECT amount FROM castle_treasury WHERE id = 1 FOR UPDATE');
  const lockedUsers = (await client.query(
    'SELECT id, username, bank, accountnumber FROM users WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
    [[userId, targetLookup.id]],
  )).rows as any[];
  let sender = lockedUsers.find(user => Number(user.id) === Number(userId));
  const target = lockedUsers.find(user => Number(user.id) === Number(targetLookup.id));
  if (!sender) throw new Error('User not found');
  if (!target) throw new Error('Счёт не найден');
  if (sender.bank < transferAmount) {
    throw new Error(`Недостаточно серебра в банке. Нужно ${transferAmount}, есть ${sender.bank}`);
  }

  if (!sender.accountnumber) {
    const generated = generateAccountNumber();
    await client.query('UPDATE users SET accountnumber = $1 WHERE id = $2', [generated, userId]);
    sender = { ...sender, accountnumber: generated };
  }

  const commission = Math.ceil(transferAmount * BANK_COMMISSION_RATE);
  const receivedAmount = transferAmount - commission;
  await client.query('UPDATE users SET bank = bank - $1 WHERE id = $2', [transferAmount, userId]);
  await client.query('UPDATE users SET bank = bank + $1 WHERE id = $2', [receivedAmount, target.id]);
  await client.query(
    'INSERT INTO transfers (fromUserId, toUserId, fromAccount, toAccount, toUsername, amount, commission, received) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [userId, target.id, sender.accountnumber, target.accountnumber, target.username, transferAmount, commission, receivedAmount],
  );
  await changeTreasuryWithClient(client, commission, 'bank_transfer');

  const updated = (await client.query('SELECT bank FROM users WHERE id = $1', [userId])).rows[0] as any;
  return { bank: updated.bank, targetUsername: target.username, commission, receivedAmount };
}
