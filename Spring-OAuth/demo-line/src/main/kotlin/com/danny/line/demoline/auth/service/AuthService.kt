package com.danny.line.demoline.auth.service

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.util.UriComponentsBuilder
import com.danny.line.demoline.utils.Const
import com.danny.line.demoline.utils.Const.OAuthConstants.KEY_CLIENT_ID

@Service
class AuthService(
    @Value("\${line.authorization.uri.scheme}")
    private val lineAuthorizationUriScheme: String,
    @Value("\${line.authorization.uri.host}")
    private val lineAuthorizationUriHost: String,
    @Value("\${line.authorization.uri.port}")
    private val lineAuthorizationUriPort: String,
    @Value("\${line.authorization.uri.path}")
    private val lineAuthorizationUriPath: String,
    @Value("\${line.authorization.redirect}")
    private val lineRedirect: String,
    @Value("\${line.authorization.response-type}")
    private val lineResponseType: String,
    @Value("\${line.authorization.scope}")
    private val lineScope: String,
    @Value("\${line.client_id}")
    private val lineClientId: String){

    fun getLineAuthorizationUri(state: String, nonce: String): String {

        val params = LinkedMultiValueMap<String, String>()
        params.add(Const.OAuthConstants.KEY_LINE_WEB_LOGIN_STATE, state)
        params.add(Const.SessionKeys.KEY_NONCE, nonce)
        params.add(KEY_CLIENT_ID, lineClientId)
        params.add(Const.OAuthConstants.KEY_RESPONSE_TYPE, lineResponseType)
        params.add(Const.OAuthConstants.KEY_REDIRECT_URI, lineRedirect)
        params.add(Const.OAuthConstants.KEY_SCOPE, lineScope)
        params.add(Const.OAuthConstants.KEY_BOT_PROMPT, Const.OAuthConstants.NORMAL)

        val uriComponents = UriComponentsBuilder.newInstance()
            .scheme(lineAuthorizationUriScheme).host(lineAuthorizationUriHost)
            .port(lineAuthorizationUriPort).path(lineAuthorizationUriPath).queryParams(params)
            .build()

        return uriComponents.toUriString()
    }
}