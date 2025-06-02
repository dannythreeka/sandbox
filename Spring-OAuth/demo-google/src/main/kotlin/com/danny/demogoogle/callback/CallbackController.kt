package com.danny.demogoogle.callback

import com.danny.demogoogle.callback.CallbackConstant.AUTHORIZATION.KEY_CODE
import com.danny.demogoogle.callback.CallbackConstant.AUTHORIZATION.KEY_ERROR
import com.danny.demogoogle.callback.CallbackConstant.CONTROLLER.PATH_CALLBACK
import com.danny.demogoogle.callback.CallbackConstant.CONTROLLER.PATH_V1
import com.danny.demogoogle.callback.CallbackConstant.CONTROLLER.VIEW_COMPLETE
import com.danny.demogoogle.exception.BadRequestException
import com.danny.demogoogle.exception.UnauthorizedException
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.servlet.ModelAndView
import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpSession

@Controller
@RequestMapping(PATH_V1)
class CallbackController(private val callbackService: CallbackService) {

    @GetMapping(PATH_CALLBACK)
    fun goToCallbackPage(
        request: HttpServletRequest,
        @RequestParam(value = KEY_CODE, required = false) code: String?,
        @RequestParam(value = KEY_ERROR, required = false) error: String?
    ): ModelAndView {
        val session = request.getSession(false)
        validateSessionExist(session)
        validateGoogleCallbackRequest(error)

        val complete = ModelAndView(VIEW_COMPLETE)
        if(!code.isNullOrEmpty()) {

            val accessTokenResponse = callbackService.getAccessToken(code ?: "")
            complete.addObject("accessTokenResponse", accessTokenResponse)
        }
        session.invalidate()
        return complete
    }

    private fun validateSessionExist(session: HttpSession?) {
        if (session == null) {
            throw BadRequestException("Where is your session?")
        }
    }

    private fun validateGoogleCallbackRequest(error: String?) {
        if (!error.isNullOrEmpty()) {
            throw UnauthorizedException(error ?: "")
        }
    }
}