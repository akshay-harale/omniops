package com.omniops.backend.service;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@Slf4j
public class LogGeneratorService {

    private final String logFilePath;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();
    private volatile boolean running = false;
    private final Random random = new Random();
    private final DateTimeFormatter dtf = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");

    private final String[] logTemplates = {
        "INFO  [web-io-8080-exec-{thread}] c.o.b.c.UserController : GET /api/v1/users/profile - HTTP 200 - {latency}ms",
        "INFO  [web-io-8080-exec-{thread}] c.o.b.c.OrderController : GET /api/v1/orders - HTTP 200 - {latency}ms",
        "INFO  [web-io-8080-exec-{thread}] c.o.b.c.ProductController : GET /api/v1/products/search?q=triage - HTTP 200 - {latency}ms",
        "DEBUG [redis-pool-executor] c.o.b.c.CacheManager : Redis Cache HIT for key user:profile:{userId}",
        "DEBUG [redis-pool-executor] c.o.b.c.CacheManager : Redis Cache HIT for key product:details:{productId}",
        "DEBUG [hikari-pool-connection] c.z.h.pool.HikariPool : HikariPool-1 - Connection pool stats (active={active}, idle={idle}, max=100, waiting=0)",
        "INFO  [kafka-consumer-thread] c.o.b.s.NotificationQueue : Processed consumer confirmation key: {userId}"
    };

    private final String[] warningTemplates = {
        "WARN  [web-io-8080-exec-{thread}] c.o.b.s.DatabaseSlowQuery : Slow database execution detected: SELECT * FROM payment WHERE status = 'PENDING' - took 1845ms",
        "WARN  [web-io-8080-exec-{thread}] c.o.b.s.RedisClient : Cache connection latency spiked to 230ms, retrying connection pool lease",
        "WARN  [web-io-8080-exec-{thread}] c.o.b.s.ExternalAuth : Auth service token validation timeout, fallback to cache auth status"
    };

    public LogGeneratorService(@Value("${log.generator.path}") String logFilePath) {
        this.logFilePath = logFilePath;
        log.info("Initialized LogGeneratorService with target path: {}", logFilePath);
    }

    public synchronized void startGenerator() {
        if (running) {
            log.info("Log generator is already running.");
            return;
        }
        running = true;
        
        // Ensure parent directory exists
        try {
            Path path = Paths.get(logFilePath);
            Path parentDir = path.getParent();
            if (parentDir != null && !Files.exists(parentDir)) {
                Files.createDirectories(parentDir);
                log.info("Created shared log directory: {}", parentDir.toAbsolutePath());
            }
        } catch (IOException e) {
            log.error("Failed to create log parent directory: {}", e.getMessage());
        }

        executorService.submit(() -> {
            log.info("Background log generator thread started.");
            int count = 0;
            while (running) {
                try {
                    String logLine = generateRandomLogLine(count);
                    appendLogLine(logLine);
                    count++;
                    // Sleep between 800ms and 1800ms
                    Thread.sleep(800 + random.nextInt(1000));
                } catch (InterruptedException e) {
                    log.warn("Log generator thread interrupted.");
                    Thread.currentThread().interrupt();
                } catch (Exception e) {
                    log.error("Error in log generator thread: {}", e.getMessage());
                }
            }
            log.info("Background log generator thread stopped.");
        });
    }

    public synchronized void stopGenerator() {
        running = false;
        log.info("Stopped log generator service.");
    }

    public boolean isRunning() {
        return running;
    }

    public List<String> readLastLines(int maxLines) {
        Path path = Paths.get(logFilePath);
        if (!Files.exists(path)) {
            return Collections.emptyList();
        }

        try {
            List<String> allLines = Files.readAllLines(path);
            if (allLines.size() <= maxLines) {
                return allLines;
            }
            return allLines.subList(allLines.size() - maxLines, allLines.size());
        } catch (IOException e) {
            log.error("Error reading generated log file: {}", e.getMessage());
            return Collections.singletonList("ERROR: Failed to read log file: " + e.getMessage());
        }
    }

    public void appendLogLine(String line) {
        Path path = Paths.get(logFilePath);
        try {
            Files.writeString(path, line + System.lineSeparator(), StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException e) {
            log.error("Failed to write to log file: {}", e.getMessage());
        }
    }

    private String generateRandomLogLine(int count) {
        String timestamp = LocalDateTime.now().format(dtf);
        String template;
        
        // Write warning logs every 15 entries
        if (count % 15 == 0 && count > 0) {
            template = warningTemplates[random.nextInt(warningTemplates.length)];
        } else {
            template = logTemplates[random.nextInt(logTemplates.length)];
        }

        // Variable Replacements
        String thread = String.valueOf(random.nextInt(8) + 1);
        String latency = String.valueOf(random.nextInt(120) + 5);
        String userId = String.valueOf(random.nextInt(9000) + 1000);
        String productId = String.valueOf(random.nextInt(200) + 1);
        String active = String.valueOf(random.nextInt(40) + 5);
        String idle = String.valueOf(100 - Integer.parseInt(active));

        String finalLog = template
            .replace("{thread}", thread)
            .replace("{latency}", latency)
            .replace("{userId}", userId)
            .replace("{productId}", productId)
            .replace("{active}", active)
            .replace("{idle}", idle);

        return timestamp + "  " + finalLog;
    }

    @PreDestroy
    public void cleanup() {
        stopGenerator();
        executorService.shutdownNow();
    }
}
