package com.danny.demofacebook.exception

class UnauthorizedException(override var message: String) : RuntimeException(message)