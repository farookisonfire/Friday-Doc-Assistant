export interface Chunk {
  id: string;
  text: string;
  url: string;
  title: string;
  headings: string[];
  chunk_index: number;
  content_hash: string;
  created_at: string;
}

export interface EmbeddedChunk extends Chunk {
  embedding_model: string;
  embedding: number[];
}

export interface RetrievedChunk extends Chunk {
  embedding_model: string;
  score: number;
}
