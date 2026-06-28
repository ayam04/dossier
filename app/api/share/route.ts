import { ObjectId } from "mongodb";
import { getDb } from "../../../lib/mongodb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { output, domain } = await req.json().catch(() => ({}));
  if (!output || typeof output !== "string") {
    return new Response("output is required", { status: 400 });
  }
  if (output.length > 200_000) return new Response("dossier too large", { status: 413 });
  try {
    const db = await getDb();
    const r = await db.collection("shares").insertOne({
      output,
      domain: typeof domain === "string" ? domain.slice(0, 200) : "",
      createdAt: new Date(),
    });
    return Response.json({ id: r.insertedId.toString() });
  } catch (e) {
    return new Response(`share failed: ${(e as Error)?.message ?? e}`, { status: 500 });
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[a-f0-9]{24}$/i.test(id)) return new Response("bad id", { status: 400 });
  try {
    const db = await getDb();
    const doc = await db.collection("shares").findOne({ _id: new ObjectId(id) });
    if (!doc) return new Response("not found", { status: 404 });
    return Response.json({ output: doc.output, domain: doc.domain ?? "" });
  } catch (e) {
    return new Response(`lookup failed: ${(e as Error)?.message ?? e}`, { status: 500 });
  }
}
