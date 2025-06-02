package com.danny.demogoogle.exception

class BadRequestException(override var message: String) : RuntimeException(message)