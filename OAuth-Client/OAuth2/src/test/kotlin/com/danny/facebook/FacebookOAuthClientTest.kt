package com.danny.facebook

import com.danny.core.OAuthClientConfig
import com.danny.core.OAuthConstant
import org.apache.http.client.HttpClient
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.Before
import org.mockito.Matchers.any
import org.mockito.Mock
import org.mockito.Mockito
import org.mockito.MockitoAnnotations
import org.apache.http.HttpEntity
import org.apache.http.client.methods.CloseableHttpResponse



class FacebookOAuthClientTest{

    private val LOGIN_DIALOG = "https://www.facebook.com:443/v3.1/dialog/oauth?"
    private val TEST_AUTHORIZATION_CODE = "wertyuiop"
    private val TEST_CLIENT_ID = "123"
    private val TEST_CLIENT_SECRET = "abc"
    private val TEST_CLIENT_SCOPE = "openid"
    private val TEST_CLIENT_REDIRECT_URI = "danny.com"
    private val EQUAL_MARK = "="
    private val AND_MARK = "&"
    private val TEST_ACCESS_TOEKN_RESPONSE = "{\n" +
            "  \"access_token\": {access-token}, \n" +
            "  \"token_type\": {type},\n" +
            "  \"expires_in\":  {seconds-til-expiration}\n" +
            "}"

    private lateinit var config: OAuthClientConfig

    @Mock
    private val defaultHttpClient: HttpClient? = null

    @Before
    fun setup(){
        config = OAuthClientConfig.setClientId(TEST_CLIENT_ID).setClientSecret(TEST_CLIENT_SECRET)
                .setScope(TEST_CLIENT_SCOPE).setRedirectUri(TEST_CLIENT_REDIRECT_URI).build()

        MockitoAnnotations.initMocks(FacebookOAuthClient::class)
    }

    @Test
    fun testAuthorizeUser(){
        val uri = FacebookOAuthClient().authorizeUser(config)
        val expect = StringBuilder(LOGIN_DIALOG)
                .append(OAuthConstant.CLIENT_ID)
                .append(EQUAL_MARK)
                .append(TEST_CLIENT_ID)
                .append(AND_MARK)
                .append(OAuthConstant.SCOPE)
                .append(EQUAL_MARK)
                .append(TEST_CLIENT_SCOPE)
                .append(AND_MARK)
                .append(OAuthConstant.REDIRECT_URI)
                .append(EQUAL_MARK)
                .append(TEST_CLIENT_REDIRECT_URI)
        assertEquals(expect.toString(), uri)
    }

    @Test
    fun testNewTokenRequest(){
        var response = Mockito.mock(CloseableHttpResponse::class.java)
        val entity = Mockito.mock(HttpEntity::class.java)

        Mockito.`when`(defaultHttpClient?.execute(any())).thenReturn(response)
        Mockito.`when`(response.statusLine.statusCode).thenReturn(200)
        Mockito.`when`(response.entity).thenReturn(entity)
        Mockito.`when`(entity.content).thenReturn(TEST_ACCESS_TOEKN_RESPONSE.byteInputStream())

        val result = FacebookOAuthClient().newTokenRequest(config, TEST_AUTHORIZATION_CODE)
        assertEquals(TEST_ACCESS_TOEKN_RESPONSE, result)
    }
}