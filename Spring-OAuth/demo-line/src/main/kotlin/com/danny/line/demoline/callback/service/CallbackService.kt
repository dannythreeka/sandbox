package com.danny.line.demoline.callback.service

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.exceptions.JWTVerificationException
import com.auth0.jwt.interfaces.DecodedJWT
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import com.danny.line.demoline.exception.UnauthorizedException
import org.springframework.http.HttpMethod
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.util.MultiValueMap
import org.springframework.web.util.UriComponentsBuilder
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import com.danny.line.demoline.callback.response.AccessTokenResponse
import com.danny.line.demoline.utils.Const.OAuthConstants.KEY_CLIENT_ID
import com.danny.line.demoline.utils.Const.OAuthConstants.KEY_CLIENT_SECRET
import com.danny.line.demoline.utils.Const.OAuthConstants.KEY_CODE
import com.danny.line.demoline.utils.Const.OAuthConstants.KEY_GRANT_TYPE
import com.danny.line.demoline.utils.Const.OAuthConstants.KEY_REDIRECT_URI
import java.io.UnsupportedEncodingException

@Service
class CallbackService(
    private val restTemplate: RestTemplate,
    @Value("\${line.access-token.uri.scheme}")
    private val lineAccessTokenUriScheme: String,
    @Value("\${line.access-token.uri.host}")
    private val lineAccessTokenUriHost: String,
    @Value("\${line.access-token.uri.port}")
    private val lineAccessTokenUriPort: String,
    @Value("\${line.access-token.uri.path}")
    private val lineAccessTokenUriPath: String,
    @Value("\${line.id-token.issuer}")
    private val lineIDTokenIssuer: String,
    @Value("\${line.authorization.redirect}")
    private val lineRedirect: String,
    @Value("\${line.authorization.grant-type}")
    private val lineGrantType: String,
    @Value("\${line.client_id}")
    private val lineClientId: String,
    @Value("\${line.client_secret}")
    private val lineClientSecret: String){

    fun getLineResponse(code: String): AccessTokenResponse {
        return callLineAccessToken(getLineAccessTokenRequestBody(code))
    }

    private fun callLineAccessToken(requestMap: MultiValueMap<String, String>): AccessTokenResponse {
        val headers = HttpHeaders()
        headers.contentType = MediaType.APPLICATION_FORM_URLENCODED
        val request = HttpEntity(requestMap, headers)

        try {
            val response = restTemplate.exchange(
                getLineAccessTokenUri(),
                HttpMethod.POST, request, AccessTokenResponse::class.java
            )
            return response?.body ?: throw UnauthorizedException("ERROR")
        } catch (e: HttpClientErrorException) {
            throw UnauthorizedException(e.localizedMessage)
        } catch (e: HttpServerErrorException) {
            throw UnauthorizedException(e.localizedMessage)
        } catch (e: Exception) {
            throw UnauthorizedException(e.localizedMessage)
        }
    }

    private fun getLineAccessTokenRequestBody(
        code: String
    ): MultiValueMap<String, String> {
        val requestBody = LinkedMultiValueMap<String, String>()
        requestBody.add(KEY_GRANT_TYPE, lineGrantType)
        requestBody.add(KEY_CLIENT_ID, lineClientId)
        requestBody.add(KEY_CLIENT_SECRET, lineClientSecret)
        requestBody.add(KEY_CODE, code)
        requestBody.add(KEY_REDIRECT_URI, lineRedirect)

        return requestBody
    }

    private fun getLineAccessTokenUri(): String {
        return UriComponentsBuilder.newInstance().scheme(lineAccessTokenUriScheme)
            .host(lineAccessTokenUriHost).port(lineAccessTokenUriPort).path(lineAccessTokenUriPath)
            .build().toString()
    }

    fun getDecodeIdToken(id_token: String): DecodedJWT {
        try {
            val algorithm = Algorithm.HMAC256(lineClientSecret)
            val verifier = JWT.require(algorithm).withIssuer(lineIDTokenIssuer).build()
            return verifier.verify(id_token)
        } catch (e: UnsupportedEncodingException) {
            throw UnauthorizedException(e.localizedMessage)
        } catch (e: JWTVerificationException) {
            throw UnauthorizedException(e.localizedMessage)
        }
    }
}