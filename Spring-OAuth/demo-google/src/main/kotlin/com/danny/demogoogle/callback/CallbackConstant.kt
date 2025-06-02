package com.danny.demogoogle.callback

object CallbackConstant{
    object CONTROLLER{
        const val PATH_V1 = "/v1"
        const val PATH_CALLBACK = "/callback"
        const val VIEW_COMPLETE = "complete"
    }

    object AUTHORIZATION{
        const val KEY_CODE = "code"
        const val KEY_ERROR = "error"
        const val KEY_GRANT_TYPE = "grant_type"
        const val KEY_CLIENT_ID = "client_id"
        const val KEY_CLIENT_SECRET = "client_secret"
        const val KEY_REDIRECT_URI = "redirect_uri"
    }
}