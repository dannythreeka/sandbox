package com.danny.line.demoline.callback.controller

import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import com.danny.line.demoline.validators.CallbackRequestValidator
import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpSession
import org.springframework.web.bind.annotation.RequestParam
import com.danny.line.demoline.callback.service.CallbackService
import com.danny.line.demoline.exception.BadRequestException
import com.danny.line.demoline.utils.Const.SessionKeys.KEY_STATE
import org.springframework.web.servlet.ModelAndView
import com.danny.line.demoline.utils.Const.RequestParam.CODE
import com.danny.line.demoline.utils.Const.RequestParam.ERROR
import com.danny.line.demoline.utils.Const.RequestParam.ERROR_DESCRIPTION
import com.danny.line.demoline.utils.Const.RequestParam.SCOPE
import com.danny.line.demoline.utils.Const.RequestParam.STATE

@Controller
@RequestMapping("/v1")
class CallbackController(
    private val callbackRequestValidator: CallbackRequestValidator,
    private val callbackService: CallbackService){

    @GetMapping("/callback")
    fun goToCallbackPage(
        request: HttpServletRequest,
        @RequestParam(value = CODE, required = false) code: String?,
        @RequestParam(value = STATE, required = false) state: String?,
        @RequestParam(value = SCOPE, required = false) scope: String?,
        @RequestParam(value = ERROR, required = false) error: String?,
        @RequestParam(value = ERROR_DESCRIPTION, required = false) errorDescription: String?

    ): ModelAndView {
        val session = request.getSession(false)
        validateSessionExist(session)

        val stateInSession = session.getAttribute(KEY_STATE) as String
        callbackRequestValidator.validateLineAuthRequest(code, error, errorDescription)
        callbackRequestValidator.validateAuthState(stateInSession, state)

        val accessTokenResponse = callbackService.getLineResponse(code ?: "")
        val idTokenJwt = callbackService.getDecodeIdToken(accessTokenResponse.id_token)

        session.invalidate()

        val complete = ModelAndView("complete")
        complete.addObject("accessTokenResponse", accessTokenResponse)
        complete.addObject("idTokenJwt", idTokenJwt.subject)

        return complete
    }

    private fun validateSessionExist(session: HttpSession?) {
        if (session == null) {
            throw BadRequestException("Where is your session?")
        }
    }
}