package com.danny.line.demoline.exception

class UnauthorizedException(override var message: String) : RuntimeException(message)