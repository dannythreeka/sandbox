package com.danny.demofacebook.utils

import org.springframework.web.bind.annotation.RequestParam

object Const {
    object OAuthConst {
        const val KEY_CLIENT_ID = "client_id"
        const val KEY_CLIENT_SECRET = "client_secret"
        const val KEY_REDIRECT_URI = "redirect_uri"
        const val KEY_LOGIN_STATE = "state"
        const val KEY_LOGIN_SCOPE = "scope"
        const val KEY_LOGIN_RESPONSE_TYPE = "response_type"
        const val KEY_CODE = "code"
        const val KEY_ERROR_REASON = "error_reason"
        const val KEY_ERROR = "error"
        const val KEY_ERROR_DESCRIPTION = "error_description"
        const val KEY_ACCESS_TOKEN = "access_token"
        const val KEY_FIELD = "fields"
    }
}