import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationError, AuthorizationError } from "@/lib/auth";
import { RateLimitError } from "@/lib/rate-limit";

export function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request.", details: error.flatten() },
      { status: 400 },
    );
  }

  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }

  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json({ error: "That item already exists in this workspace." }, { status: 409 });
    }
    if (code === "23503") {
      return NextResponse.json({ error: "The selected item no longer exists. Refresh and try again." }, { status: 409 });
    }
  }

  console.error("Unhandled API error", error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
