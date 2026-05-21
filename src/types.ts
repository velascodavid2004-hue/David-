export type WeightClass = 
  | 'Mosca' 
  | 'Gallo' 
  | 'Pluma' 
  | 'Ligero' 
  | 'Wélter' 
  | 'Medio' 
  | 'Semipesado' 
  | 'Pesado';

export interface Gym {
  id: string;
  name: string;
  location: string;
  ownerId: string;
  createdAt: string;
}

export interface Boxer {
  id: string;
  name: string;
  gymId: string;
  weightClass: WeightClass;
  wins: number;
  losses: number;
  draws: number;
  rankingPoints: number;
  cornerColor?: string;
  userId?: string;
}

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  status: 'draft' | 'open' | 'active' | 'completed';
  weightClass: WeightClass;
  organizerId: string;
  participants: string[]; // Boxer IDs
}

export interface Match {
  id: string;
  tournamentId: string;
  boxer1Id: string;
  boxer2Id: string;
  winnerId?: string;
  round: number; // 1 for Final, 2 for Semis, 4 for Quarters, etc.
  matchIndex: number;
  scheduledDate: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  videoUrl?: string;
  roundVideos?: {
    r1?: string;
    r2?: string;
    r3?: string;
  };
}
