package com.danny.line.demoline.exception.handler

import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.servlet.ModelAndView
import javax.naming.ServiceUnavailableException
import java.net.UnknownServiceException
import com.danny.line.demoline.exception.ForbiddenException
import com.danny.line.demoline.exception.BadRequestException
import com.danny.line.demoline.exception.UnauthorizedException

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

    @ResponseStatus(code = HttpStatus.FORBIDDEN)
    @ExceptionHandler(ForbiddenException::class)
    fun handleForbiddenException(ex: ForbiddenException): ModelAndView {
        return getErrorPage(ex)
    }

    @ResponseStatus(value = HttpStatus.INTERNAL_SERVER_ERROR)
    @ExceptionHandler(UnknownServiceException::class)
    fun handleUnknownServiceException(ex: UnknownServiceException): ModelAndView {
        return getErrorPage(ex)
    }

    @ResponseStatus(value = HttpStatus.SERVICE_UNAVAILABLE)
    @ExceptionHandler(ServiceUnavailableException::class)
    fun handleServiceUnavailableException(ex: ServiceUnavailableException): ModelAndView {
        return getErrorPage(ex)
    }

    private fun getErrorPage(ex: Exception): ModelAndView {
        val mav = ModelAndView()
        mav.addObject("exception", ex)
        mav.viewName = "error"
        return mav
    }
}