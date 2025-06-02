package com.danny.facebook

/**
 * Data class for Facebook Access Token Response
 *
 * @author Danny Wang <dannythreekai@gmail.com>
 */
data class AccessTokenResponse(val access_token: String, val token_type: String, val expires_in: String)