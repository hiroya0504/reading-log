package com.example.readinglog.common.error;

import org.springframework.http.HttpStatus;

/** A service this app depends on is refusing requests for now; trying later may succeed. */
public class ServiceUnavailableException extends DomainException {

  public ServiceUnavailableException(String errorCode, String message) {
    super(HttpStatus.SERVICE_UNAVAILABLE, errorCode, message);
  }
}
