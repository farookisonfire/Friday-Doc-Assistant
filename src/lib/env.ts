function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  OPENAI_API_KEY: () => requiredEnv("OPENAI_API_KEY"),
  PINECONE_API_KEY: () => requiredEnv("PINECONE_API_KEY"),
  PINECONE_INDEX: () => requiredEnv("PINECONE_INDEX"),
  PINECONE_NAMESPACE: () => requiredEnv("PINECONE_NAMESPACE"),
  LANGSMITH_API_KEY: () => requiredEnv("LANGSMITH_API_KEY"),
  DOCS_BASE_URL: () => requiredEnv("DOCS_BASE_URL"),
};
