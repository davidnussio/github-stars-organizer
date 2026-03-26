import { EmbeddingModel } from "@effect/ai"
import { Effect } from "effect"
import { EmbeddingError } from "../domain/errors.js"
import { StarDatabase } from "./database.js"

// Cosine similarity between two vectors
const cosineSimilarity = (a: readonly number[], b: readonly number[]): number => {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export class SemanticSearch extends Effect.Service<SemanticSearch>()("app/SemanticSearch", {
  effect: Effect.gen(function* () {
    const db = yield* StarDatabase
    const embedder = yield* EmbeddingModel.EmbeddingModel

    const search = (query: string, topK: number = 10) =>
      Effect.gen(function* () {
        // Embed the query
        const queryEmbedding = yield* embedder.embed(query).pipe(
          Effect.mapError(
            (err) => new EmbeddingError({ message: `Failed to embed query: ${err}` })
          )
        )

        // Get all stars with embeddings
        const stars = yield* db.getAllStarsWithEmbeddings()

        // Compute similarities
        const scored = stars
          .filter((s) => s.embedding !== null)
          .map((star) => {
            const embedding = JSON.parse(star.embedding!) as number[]
            const similarity = cosineSimilarity(queryEmbedding, embedding)
            return { ...star, similarity }
          })
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, topK)

        return scored.map((s) => ({
          repoFullName: s.repo_full_name,
          repoName: s.repo_name,
          description: s.description,
          aiAnalysis: s.ai_analysis,
          tags: s.tags ? (JSON.parse(s.tags) as string[]) : [],
          language: s.language,
          languages: s.languages ? (JSON.parse(s.languages) as string[]) : [],
          starredAt: s.starred_at,
          htmlUrl: s.html_url,
          stars: s.stargazers_count,
          similarity: Math.round(s.similarity * 1000) / 1000
        }))
      })

    return { search } as const
  })
}) {}
