export const UNIT_TYPES = ["Bedsitter", "Single room", "1 Bedroom", "2 Bedroom", "3 Bedroom"] as const;

export type UnitType = typeof UNIT_TYPES[number];
