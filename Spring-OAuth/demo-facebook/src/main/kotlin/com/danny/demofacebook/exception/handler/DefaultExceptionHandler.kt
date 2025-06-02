package com.danny.demofacebook.exception.handler

import com.danny.demofacebook.exception.BadRequestException
import com.danny.demofacebook.exception.UnauthorizedException
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.servlet.ModelAndView

@ControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class DefaultExceptionHandler {

    @ResponseStatus(code = HttpStatus.UNAUTHORIZED)
    @ExceptionHandler(UnauthorizedException::class)
    fun handleUnauthorizedException(ex: UnauthorizedException): ModelAndView {
        return getErrorPage(ex)
    }

    @ResponseStatus(code = HttpStatus.BAD_REQUEST)
    @ExceptionHandler(BadRequestException::class)
    fun handleBadRequestException(ex: BadRequestException): ModelAndView {
        return getErrorPage(ex)
    }

    private fun getErrorPage(ex: Exception): ModelAndView {
        val mav = ModelAndView()
        mav.addObject("exception", ex)
        mav.viewName = "error"
        return mav
    }
}