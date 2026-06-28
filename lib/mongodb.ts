import { MongoClient, Db } from "mongodb";

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  const g = globalThis as typeof globalThis & { _mongo?: Promise<MongoClient> };
  if (!g._mongo) g._mongo = new MongoClient(uri).connect();
  return g._mongo;
}

export async function getDb(): Promise<Db> {
  const client = await connect();
  return client.db("deal_dossier");
}
