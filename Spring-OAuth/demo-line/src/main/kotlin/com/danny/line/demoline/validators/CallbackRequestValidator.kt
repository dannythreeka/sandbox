package com.danny.line.demoline.validators

import org.springframework.stereotype.Component
import com.danny.line.demoline.exception.ForbiddenException
import com.danny.line.demoline.exception.UnauthorizedException

@Component
class CallbackRequestValidator {

    fun validateLineAuthRequest(code: String?, error: String?, errorDescription: String?) {
        if (code.isNullOrEmpty()) {
            if (error.isNullOrEmpty()) {
                throw UnauthorizedException("Authorization code is missing by unknown reason")
            }
            if (error.equals("access_denied", true)) {
                throw ForbiddenException("User Access Denied")
            }
            throw UnauthorizedException(errorDescription ?: "UNKNOWN ISSUE")
        }
    }

    fun validateAuthState(stateInSession: String?, stateInRequest: String?) {
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