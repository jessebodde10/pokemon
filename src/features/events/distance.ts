import type { Coordinates } from './types';

/**
 * Distance between two points, in kilometres.
 *
 * Straight-line (haversine), not driving distance. That difference matters
 * enough that the UI says "hemelsbreed" rather than implying a route: a fair
 * 40km away across the Westerschelde is not a 40km drive.
 */
const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.round(EARTH_RADIUS_KM * c);
}

/**
 * Reference points a visitor can measure from.
 *
 * Asking for a postcode would mean geocoding, which needs a service. Picking a
 * city from a list gets the same job done with no third party involved.
 */
export const ORIGIN_CITIES: ReadonlyArray<{
  id: string;
  label: string;
  coordinates: Coordinates;
}> = [
  {
    id: 'amsterdam',
    label: 'Amsterdam',
    coordinates: { latitude: 52.3676, longitude: 4.9041 },
  },
  {
    id: 'rotterdam',
    label: 'Rotterdam',
    coordinates: { latitude: 51.9244, longitude: 4.4777 },
  },
  {
    id: 'den-haag',
    label: 'Den Haag',
    coordinates: { latitude: 52.0705, longitude: 4.3007 },
  },
  {
    id: 'utrecht',
    label: 'Utrecht',
    coordinates: { latitude: 52.0907, longitude: 5.1214 },
  },
  {
    id: 'eindhoven',
    label: 'Eindhoven',
    coordinates: { latitude: 51.4416, longitude: 5.4697 },
  },
  {
    id: 'groningen',
    label: 'Groningen',
    coordinates: { latitude: 53.2194, longitude: 6.5665 },
  },
  {
    id: 'zwolle',
    label: 'Zwolle',
    coordinates: { latitude: 52.5168, longitude: 6.083 },
  },
  {
    id: 'maastricht',
    label: 'Maastricht',
    coordinates: { latitude: 50.8514, longitude: 5.691 },
  },
  {
    id: 'antwerpen',
    label: 'Antwerpen',
    coordinates: { latitude: 51.2194, longitude: 4.4025 },
  },
  {
    id: 'gent',
    label: 'Gent',
    coordinates: { latitude: 51.0543, longitude: 3.7174 },
  },
  {
    id: 'brussel',
    label: 'Brussel',
    coordinates: { latitude: 50.8503, longitude: 4.3517 },
  },
  {
    id: 'brugge',
    label: 'Brugge',
    coordinates: { latitude: 51.2093, longitude: 3.2247 },
  },
];

export function findOrigin(id: string | null): Coordinates | null {
  if (!id) return null;
  return ORIGIN_CITIES.find((city) => city.id === id)?.coordinates ?? null;
}
