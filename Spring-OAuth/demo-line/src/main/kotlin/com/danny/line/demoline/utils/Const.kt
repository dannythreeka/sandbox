package com.danny.line.demoline.utils

import org.springframework.web.bind.annotation.RequestParam

object Const {
    object OAuthConstants {
        const val KEY_LINE_WEB_LOGIN_STATE = "state"
        const val KEY_GRANT_TYPE = "grant_type"
        const val KEY_CLIENT_ID = "client_id"
        const val KEY_CLIENT_SECRET = "client_secret"
        const val KEY_CODE = "code"
        const val KEY_REDIRECT_URI = "redirect_uri"
        const val KEY_RESPONSE_TYPE = "response_type"
        const val KEY_SCOPE = "scope"
        const val KEY_BOT_PROMPT = "bot_prompt"
        const val NORMAL = "normal"
    }

    object SessionKeys {
        const val KEY_STATE = "state"
        const val KEY_NONCE = "nonce"
    }

    object RequestParam{
        const val CODE = "code"
        const val STATE = "state"
        const val SCOPE = "scope"
        const val ERROR = "error"
        const val ERROR_DESCRIPTION = "error_description"
    }
}