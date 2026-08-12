import { type ZodSchema, type ZodError } from "zod";

/**
 * Server Action result envelope. Every mutation returns this shape so the
 * client can render errors without throwing across the boundary.
 */
export type ActionResult<TData = undefined> =
  | { ok: true; data: TData }
  | {
      ok: false;
      error: string;
      code?: string;
      fieldErrors?: Record<string, string[]>;
    };

export function ok<TData>(data: TData): ActionResult<TData> {
  return { ok: true, data };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
  code?: string,
): ActionResult<never> {
  return { ok: false, error, fieldErrors, code };
}

/**
 * Sent when a mutation needs an authenticated user. Client components use
 * `code === "AUTH_REQUIRED"` to redirect to /sign-up instead of rendering a
 * raw error.
 */
export function failAuth(): ActionResult<never> {
  return {
    ok: false,
    code: "AUTH_REQUIRED",
    error: "Debes iniciar sesión para continuar.",
  };
}

/**
 * Parse and validate an unknown payload against a Zod schema.
 * Returns either the typed output or a formatted failure.
 */
export function parseInput<TInput, TOutput>(
  schema: ZodSchema<TOutput>,
  input: TInput,
): { success: true; data: TOutput } | { success: false; error: string; fieldErrors: Record<string, string[]> } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, ...formatZodError(result.error) };
}

/**
 * Flatten a ZodError into a top-level message plus per-field errors.
 */
export function formatZodError(error: ZodError): {
  error: string;
  fieldErrors: Record<string, string[]>;
} {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_root";
    fieldErrors[key] = fieldErrors[key] ?? [];
    fieldErrors[key].push(issue.message);
  }
  const firstMessage = error.issues[0]?.message ?? "Invalid input";
  return { error: firstMessage, fieldErrors };
}
