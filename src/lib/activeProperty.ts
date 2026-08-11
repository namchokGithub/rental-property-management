/**
 * Resolves the active property for today's single-property UI (no property
 * switcher exists yet — confirmed in the migration audit). Every Firestore
 * repository takes `propertyId` as an explicit parameter and never re-derives
 * it internally, so introducing a multi-property switcher later only means
 * changing call sites like this one, not repository internals.
 *
 * This is a plain, testable function rather than a hook: `useAuth()` can only
 * be called from inside a component or another hook, so callers must call
 * `useAuth()` themselves and pass `user.propertyIds` through. A "hook that
 * wraps a hook" here would add an indirection layer without adding behavior.
 */
export function getActivePropertyId(propertyIds: string[]): string {
  const [propertyId] = propertyIds;
  if (!propertyId) {
    throw new Error("No active property: the signed-in user has no property memberships.");
  }
  return propertyId;
}
