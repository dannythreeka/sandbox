package com.danny.demogoogle.auth

import com.danny.demogoogle.auth.AuthConstant.AUTHORIZATION.KEY_STATE
import com.danny.demogoogle.auth.AuthConstant.CONTROLLER.PATH_AUTH
import com.danny.demogoogle.auth.AuthConstant.CONTROLLER.PATH_LOGIN
import com.danny.demogoogle.auth.AuthConstant.CONTROLLER.PATH_V1
import com.danny.demogoogle.auth.AuthConstant.CONTROLLER.REDIRECT
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import java.util.UUID
import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpSession

@Controller
@RequestMapping(PATH_V1)
class AuthController(private val authService: AuthService){

    @GetMapping(PATH_LOGIN)
    fun goToLoginPage(request: HttpServletRequest): String = PATH_LOGIN

    @PostMapping(PATH_AUTH)
    fun goToAuthPage(request: HttpServletRequest): String{
        val state = UUID.randomUUID().toString()
        val httpSession = issuedSessionIfExist(request)

        httpSession.setAttribute(KEY_STATE, state)

        return REDIRECT + authService.getGoogleAuthorizationUri(state);
    }

    private fun issuedSessionIfExist(request: HttpServletRequest): HttpSession {
        val session = request.getSession(false)
        session?.invalidate()
        return request.getSession(true)
    }
}