package com.danny.demofacebook.exception

class BadRequestException(override var message: String) : RuntimeException(message)