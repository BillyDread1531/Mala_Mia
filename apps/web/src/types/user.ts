export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}
