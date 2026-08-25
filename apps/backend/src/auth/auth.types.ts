export type JwtUserPayload = {
  sub: string;
  login: string;
  sessionId: string;
  jti: string;
  mustChangePassword: boolean;
};
