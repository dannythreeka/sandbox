import { z } from "zod";

export const RegisterInputSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(30),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(72),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RefreshInputSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshInputSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const UserViewSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
});
export type UserView = z.infer<typeof UserViewSchema>;

export const AuthResultSchema = z.object({
  user: UserViewSchema,
  tokens: AuthTokensSchema,
});
export type AuthResult = z.infer<typeof AuthResultSchema>;
