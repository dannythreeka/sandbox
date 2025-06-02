package com.danny.line.demoline.exception

class BadRequestException(override var message: String) : RuntimeException(message)