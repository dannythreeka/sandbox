import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type {
  AuthResult,
  AuthTokens,
  LoginInput,
  RefreshInput,
  RegisterInput,
  UserView,
} from "@azure-voyage/shared";
import { GameError } from "../../common/errors/game-error";
import type { JwtPayload } from "../../common/auth/jwt-payload";
import { PrismaService } from "../../prisma/prisma.service";

const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new GameError("EMAIL_TAKEN");
    }
    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({
      data: { email: input.email, passwordHash, displayName: input.displayName },
    });
    return { user: this.toView(user), tokens: await this.signTokens(user.id, user.email) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new GameError("INVALID_CREDENTIALS");
    }
    return { user: this.toView(user), tokens: await this.signTokens(user.id, user.email) };
  }

  async refresh(input: RefreshInput): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(input.refreshToken);
    } catch {
      throw new GameError("INVALID_REFRESH_TOKEN");
    }
    if (payload.type !== "refresh") {
      throw new GameError("INVALID_REFRESH_TOKEN");
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new GameError("INVALID_REFRESH_TOKEN");
    }
    return this.signTokens(user.id, user.email);
  }

  private async signTokens(userId: string, email: string): Promise<AuthTokens> {
    const base = { sub: userId, email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...base, type: "access" }, { expiresIn: ACCESS_TTL }),
      this.jwtService.signAsync({ ...base, type: "refresh" }, { expiresIn: REFRESH_TTL }),
    ]);
    return { accessToken, refreshToken };
  }

  private toView(user: { id: string; email: string; displayName: string }): UserView {
    return { id: user.id, email: user.email, displayName: user.displayName };
  }
}
