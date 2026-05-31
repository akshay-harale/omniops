@echo off
set OTEL_SERVICE_NAME=demo-java-api
set OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
set OTEL_METRICS_EXPORTER=otlp
set OTEL_LOGS_EXPORTER=otlp

echo Starting Demo Java API with OpenTelemetry...
java -javaagent:opentelemetry-javaagent.jar -jar build/libs/demo-0.0.1-SNAPSHOT.jar
