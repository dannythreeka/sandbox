package com.danny.demogoogle.callback

import org.junit.Assert
import org.junit.Before
import org.junit.Test
import com.nhaarman.mockito_kotlin.any
import org.mockito.ArgumentMatchers.anyString
import org.mockito.ArgumentMatchers.eq
import org.mockito.Mockito
import org.mockito.Mockito.`when`
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.client.RestTemplate

class CallbackServiceTest {

    companion object {
        private const val GOOGLE_TOKEN_HOST = "localhost"
        private const val GOOGLE_TOKEN_PATH = "/v1"
        private const val GOOGLE_TOKEN_PORT = "443"
        private const val GOOGLE_TOKEN_SCHEME = "https"
        private const val GOOGLE_TOKEN_REDIRECT_URL = "http://localhost:8080/v1/callback"
        private const val GOOGLE_TOKEN_GRANT_TYPE = "authorization_code"
        private const val GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"
        private const val GOOGLE_CLIENT_SECRET = "YOUR_GOOGLE_CLIENT_SECRET"
        private const val GOOGLE_AUTH_CODE = "ABC"
    }

    private lateinit var callbackService: CallbackService
    private lateinit var restTemplate: RestTemplate

    @Before
    fun init() {
        restTemplate = Mockito.mock(RestTemplate::class.java)

        callbackService = CallbackService(
            restTemplate,
            GOOGLE_TOKEN_SCHEME,
            GOOGLE_TOKEN_HOST,
            GOOGLE_TOKEN_PORT,
            GOOGLE_TOKEN_PATH,
            GOOGLE_TOKEN_REDIRECT_URL,
            GOOGLE_TOKEN_GRANT_TYPE,
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET
        )

    }

    @Test
    fun getAccessToken_provideCode_ReturnResponse() {
        mockRestTemplate()
        val accessResponse = callbackService.getAccessToken(GOOGLE_AUTH_CODE)

        Assert.assertNotNull(accessResponse)
        Assert.assertTrue(accessResponse.contains("access_token"))
    }

    private fun mockRestTemplate(){
        val map = HashMap<String, String>()
        map["access_token"]="ya29.GlslBghvlNUUULPr_DVg8J1g755NJceF53b-28OtXK8YILFrT-"
        `when`(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map::class.java)))
            .thenReturn(ResponseEntity.status(HttpStatus.OK).body(map))
    }
}