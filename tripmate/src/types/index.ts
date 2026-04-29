// ── Core domain types ─────────────────────────────────────────────────────────

export interface TripHost {
  id: string;
  name: string;
  avatar: string | null;
}

export interface Trip {
  id: string;
  hostId: string;
  destination: string;
  country: string;
  startDate: string;   // ISO date string from the API
  endDate: string;
  budget: number;      // in INR
  maxGuests: number;
  tags: string[];
  coverImage: string | null;
  description: string | null;
  host: TripHost;
  _count?: {
    requests: number;
  };
  createdAt: string;
}
