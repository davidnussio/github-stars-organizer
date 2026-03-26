import { Data } from "effect"

export class GitHubApiError extends Data.TaggedError("GitHubApiError")<{
  readonly message: string
  readonly statusCode?: number
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class AiAnalysisError extends Data.TaggedError("AiAnalysisError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class EmbeddingError extends Data.TaggedError("EmbeddingError")<{
  readonly message: string
  readonly cause?: unknown
}> {}
