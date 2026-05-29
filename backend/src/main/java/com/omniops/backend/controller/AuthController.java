package com.omniops.backend.controller;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/oauth")
@CrossOrigin(origins = "*")
@Slf4j
public class AuthController {

    @PostMapping(value = "/token")
    public ResponseEntity<?> exchangeToken(
            @RequestParam(value = "grant_type", required = false) String grantTypeParam,
            @RequestParam(value = "username", required = false) String usernameParam,
            @RequestParam(value = "password", required = false) String passwordParam,
            @RequestBody(required = false) TokenRequest jsonRequest) {

        String grantType = grantTypeParam != null ? grantTypeParam : (jsonRequest != null ? jsonRequest.getGrant_type() : null);
        String username = usernameParam != null ? usernameParam : (jsonRequest != null ? jsonRequest.getUsername() : null);
        String password = passwordParam != null ? passwordParam : (jsonRequest != null ? jsonRequest.getPassword() : null);

        log.info("Received OAuth2 token request. Grant Type: {}, Username: {}", grantType, username);

        if (!"password".equalsIgnoreCase(grantType)) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "unsupported_grant_type");
            error.put("error_description", "Only 'password' grant type is supported.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        }

        if ("admin".equals(username) && "admin".equals(password)) {
            Map<String, Object> tokenResponse = new HashMap<>();
            tokenResponse.put("access_token", "mock-oauth2-access-token-12345");
            tokenResponse.put("token_type", "Bearer");
            tokenResponse.put("expires_in", 3600);
            tokenResponse.put("scope", "read write");
            tokenResponse.put("tenant_id", "00000000-0000-0000-0000-000000000001");
            return ResponseEntity.ok(tokenResponse);
        }

        Map<String, String> error = new HashMap<>();
        error.put("error", "invalid_grant");
        error.put("error_description", "Invalid username or password credentials.");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }

    @Data
    public static class TokenRequest {
        private String grant_type;
        private String username;
        private String password;
    }
}
