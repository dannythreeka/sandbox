import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import {
  LoginInputSchema,
  RefreshInputSchema,
  RegisterInputSchema,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from "@azure-voyage/shared";
import { ZodPipe } from "../../common/zod/zod.pipe";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body(new ZodPipe(RegisterInputSchema)) input: RegisterInput) {
    return this.authService.register(input);
  }

  @Post("login")
  @HttpCode(200)
  login(@Body(new ZodPipe(LoginInputSchema)) input: LoginInput) {
    return this.authService.login(input);
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(@Body(new ZodPipe(RefreshInputSchema)) input: RefreshInput) {
    return this.authService.refresh(input);
  }
}
