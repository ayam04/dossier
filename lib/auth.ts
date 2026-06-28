export function requireApiKey(req: Request): Response | null {
  const expected = process.env.NEXT_PUBLIC_API_KEY;
  if (!expected || req.headers.get("x-api-key") !== expected) {
    return new Response("unauthorized", { status: 401 });
  }
  return null;
}
