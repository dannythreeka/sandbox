package com.danny.demofacebook.auth.controller

import com.danny.demofacebook.auth.service.AuthService
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_LOGIN_STATE
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpSession
import java.util.UUID

@Controller
@RequestMapping("/v1")
class AuthController(private val authService: AuthService){

    @GetMapping("login")
    fun goToLoginPage(request: HttpServletRequest): String = "login"

    @PostMapping("auth")
    fun goToAuthPage(request: HttpServletRequest): String{
        val state = UUID.randomUUID().toString()
        val httpSession = issuedSessionIfExist(request)

        httpSession.setAttribute(KEY_LOGIN_STATE, state)

        return "redirect:" + authService.getFacebookLoginUri(state);
    }

    private fun issuedSessionIfExist(request: HttpServletRequest): HttpSession {
        val session = request.getSession(false)
        session?.invalidate()
        return request.getSession(true)
    }
}