package com.danny.demogoogle.callback


import com.danny.demogoogle.callback.CallbackConstant.AUTHORIZATION.KEY_CLIENT_ID
import com.danny.demogoogle.callback.CallbackConstant.AUTHORIZATION.KEY_CLIENT_SECRET
import com.danny.demogoogle.callback.CallbackConstant.AUTHORIZATION.KEY_CODE
import com.danny.demogoogle.callback.CallbackConstant.AUTHORIZATION.KEY_GRANT_TYPE
import com.danny.demogoogle.callback.CallbackConstant.AUTHORIZATION.KEY_REDIRECT_URI
import com.danny.demogoogle.exception.UnauthorizedException
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.util.LinkedMultiValueMap
import org.springframework.util.MultiValueMap
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.RestTemplate
import org.springframework.web.util.UriComponentsBuilder

@Service
class CallbackService(
    private val restTemplate: RestTemplate,
    @Value("\${google.token.uri.scheme}")
    private val googleTokenUriScheme: String,
    @Value("\${google.token.uri.host}")
    private val googleTokenUriHost: String,
    @Value("\${google.token.uri.port}")
    private val googleTokenUriPort: String,
    @Value("\${google.token.uri.path}")
    private val googleTokenUriPath: String,
    @Value("\${google.authorization.redirect}")
    private val googleRedirect: String,
    @Value("\${google.token.grant_type}")
    private val googleGrantType: String,
    @Value("\${google.client_id}")
    private val googleClientId: String,
    @Value("\${google.client_secret}")
    private val googleClientSecret: String){

    fun getAccessToken(code: String): Map<String,String>{
        val headers = HttpHeaders()
        headers.contentType = MediaType.APPLICATION_FORM_URLENCODED
        val request = HttpEntity(getGoogleAccessTokenRequestBody(code), headers)

        try {
            val response = restTemplate.exchange(
                getGoogleAccessTokenUri(),
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

    private fun getGoogleAccessTokenRequestBody(
        code: String
    ): MultiValueMap<String, String> {
        val requestBody = LinkedMultiValueMap<String, String>()
        requestBody.add(KEY_CLIENT_ID, googleClientId)
        requestBody.add(KEY_CLIENT_SECRET, googleClientSecret)
        requestBody.add(KEY_CODE, code)
        requestBody.add(KEY_REDIRECT_URI, googleRedirect)
        requestBody.add(KEY_GRANT_TYPE, googleGrantType)

        return requestBody
    }

    private fun getGoogleAccessTokenUri(): String {
        return UriComponentsBuilder.newInstance().scheme(googleTokenUriScheme)
            .host(googleTokenUriHost).port(googleTokenUriPort).path(googleTokenUriPath)
            .build().toString()
    }

}