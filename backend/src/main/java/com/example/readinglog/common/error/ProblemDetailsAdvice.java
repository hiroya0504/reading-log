package com.example.readinglog.common.error;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Translates exceptions into RFC 9457 {@code application/problem+json} responses.
 *
 * <p>Extends {@link ResponseEntityExceptionHandler} so Spring's own handlers for the standard MVC
 * exceptions (unreadable body, wrong method, unsupported media type, ...) run instead of the
 * catch-all below. Without that inheritance the catch-all is the most specific handler Spring can
 * find for those exceptions and answers every one of them with a 500: a client posting broken JSON
 * would be told the server is at fault, and the error log would fill with stack traces for what are
 * really client mistakes.
 *
 * <p>Spring's standard handlers are overridden rather than shadowed. Declaring a second
 * {@code @ExceptionHandler} for an exception the parent already maps makes the context fail to
 * start with an ambiguous-mapping error, so per-field validation detail is attached by overriding
 * {@link #handleMethodArgumentNotValid} instead of by adding a handler beside it.
 */
@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE)
public class ProblemDetailsAdvice extends ResponseEntityExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(ProblemDetailsAdvice.class);
  private static final URI DOMAIN_TYPE_BASE = URI.create("https://reading-log.example/problems/");

  @ExceptionHandler(DomainException.class)
  public ProblemDetail handleDomain(DomainException ex) {
    ProblemDetail detail = ProblemDetail.forStatusAndDetail(ex.getStatus(), ex.getMessage());
    detail.setType(DOMAIN_TYPE_BASE.resolve(ex.getErrorCode().toLowerCase().replace('_', '-')));
    detail.setProperty("errorCode", ex.getErrorCode());
    return detail;
  }

  /** Adds {@code errors[]} with one {@code {field, message}} entry per rejected field. */
  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
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
    return ResponseEntity.badRequest().body(detail);
  }

  /**
   * Stamps the responses Spring builds for the standard MVC exceptions with the same {@code
   * errorCode} extension the rest of the contract uses, so a client can branch on one field
   * regardless of which layer rejected the request.
   *
   * <p>The code is derived from the status itself ({@code 404} → {@code NOT_FOUND}, {@code 405} →
   * {@code METHOD_NOT_ALLOWED}). Collapsing every 4xx to a single value would defeat the purpose:
   * the client would be told "bad request" for a wrong URL and a wrong method alike.
   */
  @Override
  protected ResponseEntity<Object> handleExceptionInternal(
      Exception ex,
      Object body,
      HttpHeaders headers,
      HttpStatusCode statusCode,
      WebRequest request) {
    ResponseEntity<Object> response =
        super.handleExceptionInternal(ex, body, headers, statusCode, request);
    if (response != null && response.getBody() instanceof ProblemDetail detail) {
      detail.setProperty("errorCode", errorCodeFor(statusCode));
    }
    return response;
  }

  private static String errorCodeFor(HttpStatusCode statusCode) {
    HttpStatus status = HttpStatus.resolve(statusCode.value());
    if (status != null) {
      return status.name();
    }
    return statusCode.is4xxClientError() ? "BAD_REQUEST" : "INTERNAL_ERROR";
  }

  /**
   * Catch-all so every error response is RFC 9457-shaped instead of dropping into Spring's default
   * 500 path. Logs the cause server-side with the full stack trace; the client only gets a generic
   * message.
   *
   * <p>Reached only by exceptions the parent class does not map — genuine server faults.
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
