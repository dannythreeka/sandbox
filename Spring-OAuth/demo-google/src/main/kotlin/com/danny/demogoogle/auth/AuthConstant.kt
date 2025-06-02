package com.danny.demogoogle.auth

object AuthConstant{

    object CONTROLLER{
        const val PATH_V1 = "/v1"
        const val PATH_LOGIN = "login"
        const val PATH_AUTH = "auth"
        const val REDIRECT = "redirect:"
    }

    object AUTHORIZATION{
        const val KEY_CLIENT_ID = "client_id"
        const val KEY_REDIRECT_URI = "redirect_uri"
        const val KEY_SCOPE = "scope"
        const val KEY_ACCESS_TYPE = "access_type"
        const val KEY_STATE = "state"
        const val KEY_RESPONSE_TYPE = "response_type"
    }
}