/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseActiveEquipment } from './activeEquipment';

test('PvP uses the selected equipment slot', () => {
  const active = { weapon1: { name: 'active' } };
  const legacy = { weapon1: { name: 'legacy' } };
  assert.equal(parseActiveEquipment({ active_equip_slot: 2, equipment_2: JSON.stringify(active), equipment: JSON.stringify(legacy) }).weapon1.name, 'active');
});

test('falls back to legacy equipment when selected slot is empty', () => {
  const legacy = { weapon1: { name: 'legacy' } };
  assert.equal(parseActiveEquipment({ active_equip_slot: 2, equipment_2: '{}', equipment: JSON.stringify(legacy) }).weapon1.name, 'legacy');
});
