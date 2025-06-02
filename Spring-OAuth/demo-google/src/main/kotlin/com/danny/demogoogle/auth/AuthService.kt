package com.danny.demogoogle.auth

import org.springframework.stereotype.Service
import org.springframework.beans.factory.annotation.Value
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.util.UriComponentsBuilder
import com.danny.demogoogle.auth.AuthConstant.AUTHORIZATION.KEY_ACCESS_TYPE
import com.danny.demogoogle.auth.AuthConstant.AUTHORIZATION.KEY_CLIENT_ID
import com.danny.demogoogle.auth.AuthConstant.AUTHORIZATION.KEY_REDIRECT_URI
import com.danny.demogoogle.auth.AuthConstant.AUTHORIZATION.KEY_RESPONSE_TYPE
import com.danny.demogoogle.auth.AuthConstant.AUTHORIZATION.KEY_SCOPE
import com.danny.demogoogle.auth.AuthConstant.AUTHORIZATION.KEY_STATE

@Service
class AuthService(
    @Value("\${google.authorization.uri.scheme}")
    private val googleAuthorizationUriScheme: String,
    @Value("\${google.authorization.uri.host}")
    private val googleAuthorizationUriHost: String,
    @Value("\${google.authorization.uri.port}")
    private val googleAuthorizationUriPort: String,
    @Value("\${google.authorization.uri.path}")
    private val googleAuthorizationUriPath: String,
    @Value("\${google.authorization.redirect}")
    private val googleRedirect: String,
    @Value("\${google.authorization.response-type}")
    private val googleResponseType: String,
    @Value("\${google.authorization.scope}")
    private val googleScope: String,
    @Value("\${google.authorization.access-type}")
    private val googleAccessType: String,
    @Value("\${google.client_id}")
    private val googleClientId: String){

    fun getGoogleAuthorizationUri(state: String): String {

        val params = LinkedMultiValueMap<String, String>()
        params.add(KEY_CLIENT_ID, googleClientId)
        params.add(KEY_REDIRECT_URI, googleRedirect)
        params.add(KEY_SCOPE, googleScope)
        params.add(KEY_ACCESS_TYPE, googleAccessType)
        params.add(KEY_STATE, state)
        params.add(KEY_RESPONSE_TYPE, googleResponseType)


        val uriComponents = UriComponentsBuilder.newInstance()
            .scheme(googleAuthorizationUriScheme).host(googleAuthorizationUriHost)
            .port(googleAuthorizationUriPort).path(googleAuthorizationUriPath).queryParams(params)
            .build()

        return uriComponents.toUriString()
    }
}