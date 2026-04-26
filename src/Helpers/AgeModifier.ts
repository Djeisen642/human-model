/**
 * Returns a [floor, 1] multiplier representing how age affects a given activity.
 * Uses a parabola centred on peakAge; values below floor are clamped to floor.
 *
 * @param age - person's current age
 * @param peakAge - age at which this activity is most likely (modifier = 1)
 * @param scale - controls how steeply the modifier falls off from the peak
 * @param floor - minimum modifier value; prevents any activity from reaching zero
 * @returns multiplier in [floor, 1]
 */
export function ageModifier(age: number, peakAge: number, scale: number, floor: number): number {
  const raw = 1 - Math.pow((age - peakAge) / scale, 2);
  return Math.max(floor, raw);
}
