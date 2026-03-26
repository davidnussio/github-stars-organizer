import { FetchHttpClient } from "@effect/platform"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { OpenAiClient, OpenAiLanguageModel, OpenAiEmbeddingModel } from "@effect/ai-openai"
import { Config, Layer } from "effect"
import { GitHubApi } from "../api/github.js"
import { StarDatabase } from "../services/database.js"
import { AiAnalyzer } from "../services/ai-analyzer.js"
import { SemanticSearch } from "../services/semantic-search.js"

// --- Infrastructure layers ---

const SqliteLive = SqliteClient.layer({
  filename: "stars.db"
})

const HttpLive = FetchHttpClient.layer

const OpenAiLive = OpenAiClient.layerConfig({
  apiKey: Config.redacted("OPENAI_API_KEY")
}).pipe(Layer.provide(HttpLive))

// --- AI model layers ---

const LanguageModelLive = OpenAiLanguageModel.model("gpt-4o-mini").pipe(
  Layer.provide(OpenAiLive)
)

const EmbeddingModelLive = OpenAiEmbeddingModel.layerBatched({
  model: "text-embedding-3-small"
}).pipe(Layer.provide(OpenAiLive))

// --- Service layers ---

const GitHubApiLive = GitHubApi.Default.pipe(
  Layer.provide(HttpLive)
)

const StarDatabaseLive = StarDatabase.Default.pipe(
  Layer.provide(SqliteLive)
)

const AiAnalyzerLive = AiAnalyzer.Default.pipe(
  Layer.provide(LanguageModelLive)
)

const SemanticSearchLive = SemanticSearch.Default.pipe(
  Layer.provide(StarDatabaseLive),
  Layer.provide(EmbeddingModelLive)
)

// --- Composed layers ---

// Base layer: no OpenAI needed (for sync, stats)
export const BaseLive = Layer.mergeAll(
  GitHubApiLive,
  StarDatabaseLive
)

// Full layer: includes AI services
export const AppLive = Layer.mergeAll(
  GitHubApiLive,
  StarDatabaseLive,
  AiAnalyzerLive,
  EmbeddingModelLive,
  SemanticSearchLive
)
