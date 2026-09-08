/**
 * Common ship/vessel areas — used for the area filter on the corrosion
 * dashboard. Keep in sync with corrosionmobileapp/src/lib/shipAreas.ts (no
 * shared package between the two repos — this is a small, rarely-changing
 * list, so a synced copy is simpler than cross-repo tooling).
 */
export const COMMON_SHIP_AREAS: string[] = [
  "Engine room",
  "Bridge",
  "Main deck",
  "Bow",
  "Stern",
  "Cargo hold",
  "Ballast tank",
  "Hull (below waterline)",
  "Hull (above waterline)",
  "Superstructure",
  "Deckhouse",
  "Anchor / chain locker",
  "Rudder / steering gear",
  "Propeller / stern tube",
  "Freeboard deck",
];
