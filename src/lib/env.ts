function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  OPENAI_API_KEY: () => requiredEnv("OPENAI_API_KEY"),
  PINECONE_API_KEY: () => requiredEnv("PINECONE_API_KEY"),
  PINECONE_INDEX: () => requiredEnv("PINECONE_INDEX"),
  PINECONE_NAMESPACE: () => requiredEnv("PINECONE_NAMESPACE"),
  LANGSMITH_API_KEY: () => requiredEnv("LANGSMITH_API_KEY"),
  DOCS_BASE_URL: () => requiredEnv("DOCS_BASE_URL"),
  OPENAI_EMBEDDING_MODEL: () => optionalEnv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
  EMBED_BATCH_SIZE: () => parseInt(optionalEnv("EMBED_BATCH_SIZE", "100"), 10),
  EMBED_CONCURRENCY: () => parseInt(optionalEnv("EMBED_CONCURRENCY", "2"), 10),
};
