/**
 * Pulls a message out of an RFC 9457 problem+json body. The backend puts field-level failures in
 * `errors[]` (see `ProblemDetailsAdvice`), which is what the user actually needs to see — `detail`
 * alone just says "Request validation failed".
 *
 * The `errors[].field` / `errors[].message` key names are an extension property, so they are not in
 * the generated schema and cannot be type-checked here. `BookApiTest` asserts their exact shape;
 * that test is what keeps this cast honest.
 */
export function problemMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const body = error as {
      detail?: string;
      errors?: Array<{ field?: string; message?: string }>;
    };
    const fieldErrors = body.errors
      ?.map((e) => [e.field, e.message].filter(Boolean).join(": "))
      .filter((line) => line.length > 0);
    if (fieldErrors && fieldErrors.length > 0) {
      return fieldErrors.join(" / ");
    }
    if (body.detail) {
      return body.detail;
    }
  }
  return fallback;
}
