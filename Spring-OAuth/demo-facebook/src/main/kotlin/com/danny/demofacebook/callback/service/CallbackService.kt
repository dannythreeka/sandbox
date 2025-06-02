package com.danny.demofacebook.callback.service

import com.danny.demofacebook.exception.UnauthorizedException
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_ACCESS_TOKEN
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_CLIENT_ID
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_CLIENT_SECRET
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_CODE
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_FIELD
import com.danny.demofacebook.utils.Const.OAuthConst.KEY_REDIRECT_URI
import org.springframework.stereotype.Service
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.util.LinkedMultiValueMap
import org.springframework.util.MultiValueMap
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.RestTemplate
import org.springframework.web.util.UriComponentsBuilder

@Service
class CallbackService(private val restTemplate: RestTemplate,
    @Value("\${facebook.graph-api.uri.scheme}")
    private val facebookGraphApiUriScheme: String,
    @Value("\${facebook.graph-api.uri.host}")
    private val facebookGraphApiUriHost: String,
    @Value("\${facebook.graph-api.uri.port}")
    private val facebookGraphApiUriPort: String,
    @Value("\${facebook.graph-api.access-token.path}")
    private val facebookAccessTokenPath: String,
    @Value("\${facebook.graph-api.me.path}")
    private val facebookMePath: String,
    @Value("\${facebook.graph-api.me.field}")
    private val facebookMeField: String,
    @Value("\${facebook.client.id}")
    private val facebookClientId: String,
    @Value("\${facebook.client.secret}")
    private val facebookClientSecret: String,
    @Value("\${facebook.client.redirect_uri}")
    private val facebookClientRedirectUrl: String){

    fun getAccessToken(code: String): Map<String,String>{
        val headers = HttpHeaders()
        headers.contentType = MediaType.APPLICATION_FORM_URLENCODED
        val request = HttpEntity(getFacebookAccessTokenRequestBody(code), headers)

        try {
            val response = restTemplate.exchange(
                getFacebookAccessTokenUri(),
                HttpMethod.POST, request, Map::class.java)

            return response?.body as Map<String,String>
        } catch (e: HttpClientErrorException) {
            throw UnauthorizedException(e.localizedMessage)
        } catch (e: HttpServerErrorException) {
            throw UnauthorizedException(e.localizedMessage)
        } catch (e: Exception) {
            throw UnauthorizedException(e.localizedMessage)
        }
    }

    fun getUserProfile(accessToken: String): Map<String,String>{
        val headers = HttpHeaders()
        headers.contentType = MediaType.APPLICATION_FORM_URLENCODED
        val request = HttpEntity(getFacebookMeRequestBody(accessToken), headers)

        try {
            val response = restTemplate.exchange(
                getFacebookMeUri(),
                HttpMethod.POST, request, Map::class.java)

            return response?.body as Map<String,String>
        } catch (e: HttpClientErrorException) {
            throw UnauthorizedException(e.localizedMessage)
        } catch (e: HttpServerErrorException) {
            throw UnauthorizedException(e.localizedMessage)
        } catch (e: Exception) {
            throw UnauthorizedException(e.localizedMessage)
        }
    }

    private fun getFacebookAccessTokenRequestBody(
        code: String
    ): MultiValueMap<String, String> {
        val requestBody = LinkedMultiValueMap<String, String>()
        requestBody.add(KEY_CLIENT_ID, facebookClientId)
        requestBody.add(KEY_CLIENT_SECRET, facebookClientSecret)
        requestBody.add(KEY_CODE, code)
        requestBody.add(KEY_REDIRECT_URI, facebookClientRedirectUrl)

        return requestBody
    }

    private fun getFacebookMeRequestBody(
        accessToken: String
    ): MultiValueMap<String, String> {
        val requestBody = LinkedMultiValueMap<String, String>()
        requestBody.add(KEY_ACCESS_TOKEN, accessToken)
        requestBody.add(KEY_FIELD, facebookMeField)

        return requestBody
    }

    private fun getFacebookAccessTokenUri(): String {
        return UriComponentsBuilder.newInstance().scheme(facebookGraphApiUriScheme)
            .host(facebookGraphApiUriHost).port(facebookGraphApiUriPort).path(facebookAccessTokenPath)
            .build().toString()
    }

    private fun getFacebookMeUri(): String {
        return UriComponentsBuilder.newInstance().scheme(facebookGraphApiUriScheme)
            .host(facebookGraphApiUriHost).port(facebookGraphApiUriPort).path(facebookMePath)
            .build().toString()
    }
}