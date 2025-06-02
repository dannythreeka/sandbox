package com.danny.demogoogle.exception

class UnauthorizedException(override var message: String) : RuntimeException(message)