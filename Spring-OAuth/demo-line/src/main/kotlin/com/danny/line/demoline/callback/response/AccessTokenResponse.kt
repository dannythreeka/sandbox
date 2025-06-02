package com.danny.line.demoline.callback.response

data class AccessTokenResponse(
    val scope: String,
    val access_token: String,
    val token_type: String,
    val expires_in: String,
    val refresh_token: String,
    val id_token: String)