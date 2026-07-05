import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { GameError } from "../../common/errors/game-error";
import type { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";

type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
};

function makePrismaMock(rows: UserRow[] = []) {
  const users = [...rows];
  return {
    users,
    prisma: {
      user: {
        findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
          return (
            users.find((u) =>
              where.email ? u.email === where.email : u.id === where.id,
            ) ?? null
          );
        }),
        create: jest.fn(async ({ data }: { data: Omit<UserRow, "id"> }) => {
          const user = { id: `u${users.length + 1}`, ...data };
          users.push(user);
          return user;
        }),
      },
    } as unknown as PrismaService,
  };
}

describe("AuthService", () => {
  const jwtService = new JwtService({ secret: "test-secret" });

  it("registers a new user with a hashed password and returns tokens", async () => {
    const { prisma, users } = makePrismaMock();
    const service = new AuthService(prisma, jwtService);

    const result = await service.register({
      email: "a@example.com",
      password: "password123",
      displayName: "提督A",
    });

    expect(result.user.email).toBe("a@example.com");
    expect(result.tokens.accessToken).toBeTruthy();
    expect(users[0].passwordHash).not.toContain("password123");
    await expect(argon2.verify(users[0].passwordHash, "password123")).resolves.toBe(true);

    const payload = jwtService.verify<{ type: string; sub: string }>(
      result.tokens.accessToken,
    );
    expect(payload.type).toBe("access");
    expect(payload.sub).toBe(result.user.id);
  });

  it("rejects duplicate email with EMAIL_TAKEN", async () => {
    const { prisma } = makePrismaMock([
      { id: "u1", email: "a@example.com", passwordHash: "x", displayName: "A" },
    ]);
    const service = new AuthService(prisma, jwtService);

    await expect(
      service.register({ email: "a@example.com", password: "password123", displayName: "B" }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("logs in with correct credentials and rejects wrong password", async () => {
    const passwordHash = await argon2.hash("correct-horse");
    const { prisma } = makePrismaMock([
      { id: "u1", email: "a@example.com", passwordHash, displayName: "A" },
    ]);
    const service = new AuthService(prisma, jwtService);

    const ok = await service.login({ email: "a@example.com", password: "correct-horse" });
    expect(ok.user.id).toBe("u1");

    await expect(
      service.login({ email: "a@example.com", password: "wrong" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("refuses an access token passed as refresh token", async () => {
    const passwordHash = await argon2.hash("correct-horse");
    const { prisma } = makePrismaMock([
      { id: "u1", email: "a@example.com", passwordHash, displayName: "A" },
    ]);
    const service = new AuthService(prisma, jwtService);
    const { tokens } = await service.login({
      email: "a@example.com",
      password: "correct-horse",
    });

    await expect(service.refresh({ refreshToken: tokens.accessToken })).rejects.toBeInstanceOf(
      GameError,
    );
    await expect(service.refresh({ refreshToken: tokens.refreshToken })).resolves.toHaveProperty(
      "accessToken",
    );
  });
});
