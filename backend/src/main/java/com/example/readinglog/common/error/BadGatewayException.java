package com.example.readinglog.common.error;

import org.springframework.http.HttpStatus;

/** A service this app depends on failed or answered with something unusable. */
public class BadGatewayException extends DomainException {

  public BadGatewayException(String errorCode, String message) {
    super(HttpStatus.BAD_GATEWAY, errorCode, message);
  }
}
