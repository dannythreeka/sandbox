package com.danny.demofacebook.callback.controller

import com.danny.demofacebook.callback.service.CallbackService
import com.danny.demofacebook.exception.BadRequestException
import com.danny.demofacebook.exception.UnauthorizedException
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_CODE
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_ERROR
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_ERROR_DESCRIPTION
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_ERROR_REASON
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_LOGIN_STATE
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.servlet.ModelAndView
import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpSession

@Controller
@RequestMapping("/v1")
class CallbackController(val callbackService: CallbackService) {
    @GetMapping("/callback")
    fun goToCallbackPage(
        request: HttpServletRequest,
        @RequestParam(value = KEY_LOGIN_STATE, required = false) state: String?,
        @RequestParam(value = KEY_CODE, required = false) code: String?,
        @RequestParam(value = KEY_ERROR_REASON, required = false) errorReason: String?,
        @RequestParam(value = KEY_ERROR, required = false) error: String?,
        @RequestParam(value = KEY_ERROR_DESCRIPTION, required = false) errorDescription: String?): ModelAndView{

        val session = request.getSession(false)
        validateSessionExist(session)
        validateCallbackState(session.getAttribute(KEY_LOGIN_STATE) as String, state)
        validateFacebookCallbackRequest(error, errorReason, errorDescription)

        val complete = ModelAndView("complete")
        if(!code.isNullOrEmpty()){
            val accessTokenResponse  = callbackService.getAccessToken(code ?: "")
            val userProfile = callbackService.getUserProfile(accessTokenResponse["access_token"] ?: "")
            complete.addObject("userProfile", userProfile)
        }

        session.invalidate()

        return complete
    }

    private fun validateSessionExist(session: HttpSession?) {
        if (session == null) {
            throw BadRequestException("Where is your session?")
        }
    }

    private fun validateFacebookCallbackRequest(error: String?, errorReason: String?, errorDescription: String?) {
        if (!error.isNullOrEmpty()) {
            throw UnauthorizedException(errorReason ?: errorDescription ?: "")
        }
    }

    private fun validateCallbackState(stateInSession: String?, stateInRequest: String?) {
        if (stateInSession.isNullOrEmpty()) {
            throw UnauthorizedException("State in Session is missing")
        }
        if (stateInRequest.isNullOrEmpty()) {
            throw UnauthorizedException("State in request is missing")
        }
        if (!stateInRequest.equals(stateInSession)) {
            throw UnauthorizedException("State is not match")
        }
    }
}