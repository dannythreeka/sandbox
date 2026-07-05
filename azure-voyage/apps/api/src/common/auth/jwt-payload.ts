export interface JwtPayload {
  sub: string; // userId
  email: string;
  type: "access" | "refresh";
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
}
