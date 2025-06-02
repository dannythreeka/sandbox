package com.danny.core

import org.junit.Assert.assertEquals
import org.junit.Test

class OAuthClientConfigTest{
    private val TEST_CLIENT_ID = "123"
    private val TEST_CLIENT_SECRET = "abc"
    private val TEST_CLIENT_SCOPE = "openid"
    private val TEST_CLIENT_REDIRECT_URI = "http://danny.com"

    @Test
    fun testOAuthClientConfig(){
        val tester = OAuthClientConfig.setClientId(TEST_CLIENT_ID).setClientSecret(TEST_CLIENT_SECRET)
            .setScope(TEST_CLIENT_SCOPE).setRedirectUri(TEST_CLIENT_REDIRECT_URI).build()

        assertEquals(TEST_CLIENT_ID, tester.getClientId())
        assertEquals(TEST_CLIENT_SECRET, tester.getClientSecret())
        assertEquals(TEST_CLIENT_SCOPE, tester.getScope())
        assertEquals(TEST_CLIENT_REDIRECT_URI, tester.getRedirectUri())
    }
}