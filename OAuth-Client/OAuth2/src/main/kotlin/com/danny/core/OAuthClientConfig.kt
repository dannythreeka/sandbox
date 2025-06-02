package com.danny.core

/**
 * OAuth Client config contains configuration
 *
 * @author Danny Wang <dannythreekai@gmail.com>
 */
class OAuthClientConfig(val param: Map<String, String>){
    
    companion object Builder {
        private val param = HashMap<String, String>()

        fun setClientId(clientId: String): Builder{
            param.put(OAuthConstant.CLIENT_ID, clientId)
            return this
        }

        fun setClientSecret(clientSecret: String): Builder{
            param.put(OAuthConstant.CLIENT_SECRET, clientSecret)
            return this
        }

        fun setScope(scope: String): Builder{
            param.put(OAuthConstant.SCOPE, scope)
            return this
        }

        fun setRedirectUri(redirectUri: String): Builder{
            param.put(OAuthConstant.REDIRECT_URI, redirectUri)
            return this
        }

        fun build(): OAuthClientConfig = OAuthClientConfig(param)
    }

    fun getClientId(): String?{
            return param[OAuthConstant.CLIENT_ID]
    }

    fun getClientSecret(): String?{
        return param[OAuthConstant.CLIENT_SECRET]
    }

    fun getScope(): String?{
        return param[OAuthConstant.SCOPE]
    }

    fun getRedirectUri(): String?{
        return param[OAuthConstant.REDIRECT_URI]
    }
}