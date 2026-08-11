package com.example.readinglog.common.error;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Translates exceptions into RFC 9457 {@code application/problem+json} responses.
 *
 * <p>Standard Spring exceptions (e.g. {@code HttpRequestMethodNotSupportedException}) already
 * produce {@code ProblemDetail} responses out of the box, so this advice only adds handlers for our
 * domain exceptions and for bean validation failures (to attach per-field errors).
 */
@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE)
public class ProblemDetailsAdvice {

  private static final Logger log = LoggerFactory.getLogger(ProblemDetailsAdvice.class);
  private static final URI DOMAIN_TYPE_BASE = URI.create("https://reading-log.example/problems/");

  @ExceptionHandler(DomainException.class)
  public ProblemDetail handleDomain(DomainException ex) {
    ProblemDetail detail = ProblemDetail.forStatusAndDetail(ex.getStatus(), ex.getMessage());
    detail.setType(DOMAIN_TYPE_BASE.resolve(ex.getErrorCode().toLowerCase().replace('_', '-')));
    detail.setProperty("errorCode", ex.getErrorCode());
    return detail;
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
    List<Map<String, String>> errors =
        ex.getBindingResult().getFieldErrors().stream()
            .map(
                fe ->
                    Map.of(
                        "field",
                        fe.getField(),
                        "message",
                        fe.getDefaultMessage() == null ? "invalid" : fe.getDefaultMessage()))
            .toList();
    ProblemDetail detail =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request validation failed");
    detail.setType(DOMAIN_TYPE_BASE.resolve("validation-error"));
    detail.setProperty("errorCode", "VALIDATION_ERROR");
    detail.setProperty("errors", errors);
    return detail;
  }

  /**
   * Catch-all so every error response is RFC 9457-shaped instead of dropping into Spring's default
   * 500 path. Logs the cause server-side with the full stack trace; the client only gets a generic
   * message.
   *
   * <p>Spring's own {@code ResponseEntityExceptionHandler} produces ProblemDetail for the standard
   * HTTP exceptions (404, 405, 415, ...) before this catch-all runs.
   */
  @ExceptionHandler(Exception.class)
  public ProblemDetail handleUnexpected(Exception ex) {
    log.error("Unhandled exception reached ProblemDetailsAdvice catch-all", ex);
    ProblemDetail detail =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred");
    detail.setType(DOMAIN_TYPE_BASE.resolve("internal-error"));
    detail.setProperty("errorCode", "INTERNAL_ERROR");
    return detail;
  }
}
