package com.example.demo;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
public class HelloController {

    private static final Logger log = LoggerFactory.getLogger(HelloController.class);

    @GetMapping("/hello")
    public String hello() {
        log.info("Received request for /hello endpoint");
        return "Hello from Demo Java API!";
    }

    @GetMapping("/simulate-error")
    public String simulateError() {
        log.error("This is a simulated error meant for SigNoz to pick up!");
        throw new RuntimeException("Simulated error triggered by /simulate-error endpoint");
    }
}
