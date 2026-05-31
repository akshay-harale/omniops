package com.omniops.backend.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.io.IOException;

@Component
@Slf4j
public class AuthFilter implements Filter {

    private static final String MOCK_TOKEN = "Bearer mock-oauth2-access-token-12345";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String path = httpRequest.getRequestURI();
        String method = httpRequest.getMethod();

        // 1. Allow OPTIONS (CORS preflight) immediately
        if ("OPTIONS".equalsIgnoreCase(method)) {
            chain.doFilter(request, response);
            return;
        }

        // 2. Allow OAuth token endpoints, webhook ingestion, and internal context endpoints to bypass auth
        if (path.contains("/oauth/token") || path.startsWith("/api/webhooks/") || path.startsWith("/api/context/")) {
            chain.doFilter(request, response);
            return;
        }

        // 3. For any other /api/** routes, enforce authorization header
        if (path.startsWith("/api/")) {
            String authHeader = httpRequest.getHeader("Authorization");
            if (authHeader == null || !authHeader.equals(MOCK_TOKEN)) {
                log.warn("Blocked unauthorized request to: {}", path);
                httpResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                httpResponse.setContentType("application/json");
                httpResponse.getWriter().write("{\"error\": \"unauthorized\", \"message\": \"Full authentication is required to access this resource.\"}");
                return;
            }
        }

        // Allow request to proceed
        chain.doFilter(request, response);
    }
}
