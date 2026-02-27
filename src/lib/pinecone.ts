import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "./env";

let client: Pinecone | null = null;

export function pineconeIndex() {
  if (!client) {
    client = new Pinecone({ apiKey: env.PINECONE_API_KEY() });
  }
  return client.index({ name: env.PINECONE_INDEX() }).namespace(env.PINECONE_NAMESPACE());
}
