export function parseActiveEquipment(user: any): Record<string, any> {
  const parse = (value: any): Record<string, any> => {
    if (typeof value === 'string') {
      try { return JSON.parse(value || '{}') || {}; } catch { return {}; }
    }
    return value && typeof value === 'object' ? value : {};
  };

  const slot = Number(user?.active_equip_slot ?? user?.activeEquipSlot ?? 1);
  const active = parse(user?.[`equipment_${slot}`]);
  return Object.keys(active).length > 0 ? active : parse(user?.equipment);
}
