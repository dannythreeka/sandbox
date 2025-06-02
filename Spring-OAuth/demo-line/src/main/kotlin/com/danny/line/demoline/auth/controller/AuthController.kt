package com.danny.line.demoline.auth.controller

import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import com.danny.line.demoline.utils.Const.SessionKeys.KEY_NONCE
import com.danny.line.demoline.utils.Const.SessionKeys.KEY_STATE
import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpSession
import java.util.UUID
import com.danny.line.demoline.auth.service.AuthService

@Controller
@RequestMapping("/v1")
class AuthController(private val authService: AuthService){

    @GetMapping("login")
    fun goToLoginPage(request: HttpServletRequest): String = "login"

    @PostMapping("auth")
    fun goToAuthPage(request: HttpServletRequest): String{
        val state = UUID.randomUUID().toString()
        val nonce = UUID.randomUUID().toString()
        val httpSession = issuedSessionIfExist(request)

        httpSession.setAttribute(KEY_STATE, state)
        httpSession.setAttribute(KEY_NONCE, nonce)

        return "redirect:" + authService.getLineAuthorizationUri(state, nonce);
    }

    private fun issuedSessionIfExist(request: HttpServletRequest): HttpSession {
        val session = request.getSession(false)
        session?.invalidate()
        return request.getSession(true)
    }
}