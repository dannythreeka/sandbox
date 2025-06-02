package com.danny.demELK

import org.apache.logging.log4j.LogManager
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class HelloController{
    companion object {
        private val logger = LogManager.getLogger(DemElkApplication::class.java)
    }

    @GetMapping(path = ["/test"])
    fun hello(): String{
        logger.info("hello world")
        return "hello world"
    }
}