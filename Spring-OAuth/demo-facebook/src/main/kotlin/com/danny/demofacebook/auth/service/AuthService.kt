package com.danny.demofacebook.auth.service

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.util.UriComponentsBuilder
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_LOGIN_STATE
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_CLIENT_ID
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_REDIRECT_URI
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_LOGIN_SCOPE
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_LOGIN_RESPONSE_TYPE

@Service
class AuthService(
    @Value("\${facebook.login.scheme}")
    private val facebookLoginUriScheme: String,
    @Value("\${facebook.login.host}")
    private val facebookLoginUriHost: String,
    @Value("\${facebook.login.port}")
    private val facebookLoginUriPort: String,
    @Value("\${facebook.login.path}")
    private val facebookLoginUriPath: String,
    @Value("\${facebook.client.id}")
    private val facebookClientId: String,
    @Value("\${facebook.client.scope}")
    private val facebookClientScope: String,
    @Value("\${facebook.client.redirect_uri}")
    private val facebookClientRedirectUrl: String,
    @Value("\${facebook.client.response_type}")
    private val facebookClientResponseType: String){

    fun getFacebookLoginUri(state: String): String {

        val params = LinkedMultiValueMap<String, String>()
        params.add(KEY_LOGIN_STATE, state)
        params.add(KEY_CLIENT_ID, facebookClientId)
        params.add(KEY_REDIRECT_URI, facebookClientRedirectUrl)
        params.add(KEY_LOGIN_SCOPE, facebookClientScope)
        params.add(KEY_LOGIN_RESPONSE_TYPE, facebookClientResponseType)


        val uriComponents = UriComponentsBuilder.newInstance()
            .scheme(facebookLoginUriScheme).host(facebookLoginUriHost)
            .port(facebookLoginUriPort).path(facebookLoginUriPath).queryParams(params)
            .build()

        return uriComponents.toUriString()
    }
}