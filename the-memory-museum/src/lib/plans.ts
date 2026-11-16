import type { PlanId } from './types';

/** Proposed packages. Prices are initial proposals to validate before launch. */
export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  tagline: string;
  maxPhotos: number;
  maxRooms: number;
  video: boolean;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'starter', name: 'Starter Museum', price: '€19', tagline: 'A first private gallery',
    maxPhotos: 15, maxRooms: 3, video: false,
    features: ['One private museum', 'Three palace rooms', 'Up to 15 photographs', 'Two visitors, together'],
  },
  {
    id: 'premium', name: 'Premium Museum', price: '€39', tagline: 'The full palace experience',
    maxPhotos: 50, maxRooms: 5, video: false,
    features: ['All five galleries', 'Up to 50 photographs', 'Personal messages on every memory', 'Avatar and wall customisation'],
  },
  {
    id: 'luxury', name: 'Luxury Museum', price: '€79', tagline: 'Every detail, considered',
    maxPhotos: 150, maxRooms: 8, video: true,
    features: ['Extended architecture, up to 8 rooms', 'Up to 150 photographs', 'Video memories', 'Background music and premium finishes'],
  },
  {
    id: 'custom', name: 'Custom Museum', price: '€149+', tagline: 'Designed for one couple only',
    maxPhotos: 500, maxRooms: 16, video: true,
    features: ['Bespoke museum design', 'Advanced character customisation', 'Custom architectural details', 'Made with you by LAUGNA DIGITALE'],
  },
];

export const planById = (id: PlanId): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0];
