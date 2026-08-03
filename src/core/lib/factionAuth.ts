// src/core/lib/factionAuth.ts
export function canManageFaction(
  faction: { founderUserId: string; verifiedCreatorUserId: string | null },
  userId: string
): boolean {
  return userId === faction.founderUserId
    || (!!faction.verifiedCreatorUserId && userId === faction.verifiedCreatorUserId);
}
