export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function readJson(
  request: Request,
  maxBytes = 65536,
): Promise<unknown> {
  if (
    request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new HttpError(
      415,
      "unsupported_media_type",
      "Use Content-Type: application/json.",
    );
  if (Number(request.headers.get("Content-Length")) > maxBytes)
    throw new HttpError(413, "payload_too_large", "Request body is too large.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new HttpError(400, "invalid_json", "A JSON body is required.");
  let size = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(
        413,
        "payload_too_large",
        "Request body is too large.",
      );
    }
    parts.push(chunk.value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new HttpError(
      400,
      "invalid_json",
      "The request body must be valid JSON.",
    );
  }
}
