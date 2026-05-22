/** Pin / row identifiers shared between the multi-pin map and the lightbox.
 *
 * The map exposes selection by `pin.id`; the lightbox sidebar mirrors that
 * selection with `activeId`. Both sides must agree on the exact string —
 * a typo (`places-` vs `place-`) silently breaks selection sync.
 *
 * Four families:
 *   - `place-<id>`           confirmed parking place (`LocalPlace.id`)
 *   - `sug-<providerId>`     parking suggestion (not yet confirmed)
 *   - `arrival-<id>`         confirmed arrival option (`LocalPlace.id` within an `ArrivalMode`)
 *   - `arrival-sug-<providerId>` arrival suggestion (not yet confirmed)
 */
export const pinIdForPlace = (placeId: string): string => `place-${placeId}`;
export const pinIdForSuggestion = (providerPlaceId: string): string =>
  `sug-${providerPlaceId}`;
export const pinIdForArrival = (arrivalId: string): string =>
  `arrival-${arrivalId}`;
export const pinIdForArrivalSuggestion = (providerPlaceId: string): string =>
  `arrival-sug-${providerPlaceId}`;
