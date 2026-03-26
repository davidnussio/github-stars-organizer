import { EmbeddingModel } from "@effect/ai"
import { Effect, Schedule } from "effect"
import { GitHubApi } from "./api/github.js"
import { StarDatabase } from "./services/database.js"
import { AiAnalyzer } from "./services/ai-analyzer.js"
import { SemanticSearch } from "./services/semantic-search.js"
import { AppLive, BaseLive } from "./layers/app-layer.js"

// --- Commands ---

const syncStars = (username: string) =>
  Effect.gen(function* () {
    const github = yield* GitHubApi
    const db = yield* StarDatabase

    yield* Effect.log(`Syncing stars for ${username}...`)
    const stars = yield* github.fetchAllStars(username)

    yield* Effect.forEach(
      stars,
      (star) =>
        Effect.gen(function* () {
          const languages = yield* github.fetchRepoLanguages(star.repo.full_name)
          yield* db.upsertStar(star, languages)
        }).pipe(
          Effect.tap(() => Effect.log(`Synced: ${star.repo.full_name}`)),
          Effect.delay("200 millis")
        ),
      { concurrency: 1 }
    )

    yield* Effect.log(`Synced ${stars.length} stars to database`)
  })

const analyzeStars = () =>
  Effect.gen(function* () {
    const db = yield* StarDatabase
    const analyzer = yield* AiAnalyzer

    const unanalyzed = yield* db.getStarsWithoutAnalysis()
    yield* Effect.log(`Analyzing ${unanalyzed.length} repos...`)

    yield* Effect.forEach(
      unanalyzed,
      (repo) =>
        analyzer.analyzeRepo(repo).pipe(
          Effect.andThen((result) =>
            db.updateAiAnalysis(repo.repo_full_name, result.summary, result.tags)
          ),
          Effect.tap(() => Effect.log(`Analyzed: ${repo.repo_full_name}`)),
          Effect.retry(Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(2)))),
          Effect.catchAll((err) => Effect.log(`Skipping ${repo.repo_full_name}: ${err}`))
        ),
      { concurrency: 3 }
    )

    yield* Effect.log("Analysis complete")
  })

const embedStars = () =>
  Effect.gen(function* () {
    const db = yield* StarDatabase
    const embedder = yield* EmbeddingModel.EmbeddingModel

    const unembedded = yield* db.getStarsWithoutEmbedding()
    yield* Effect.log(`Embedding ${unembedded.length} repos...`)

    yield* Effect.forEach(
      unembedded,
      (repo) =>
        Effect.gen(function* () {
          const text = repo.search_text ?? repo.description ?? repo.repo_full_name
          const embedding = yield* embedder.embed(text)
          yield* db.updateEmbedding(repo.repo_full_name, embedding)
        }).pipe(
          Effect.tap(() => Effect.log(`Embedded: ${repo.repo_full_name}`)),
          Effect.retry(Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(2)))),
          Effect.catchAll((err) => Effect.log(`Skipping ${repo.repo_full_name}: ${err}`))
        ),
      { concurrency: 5 }
    )

    yield* Effect.log("Embedding complete")
  })

const searchStars = (query: string, topK: number = 10) =>
  Effect.gen(function* () {
    const search = yield* SemanticSearch

    yield* Effect.log(`Searching for: "${query}"`)
    const results = yield* search.search(query, topK)

    for (const r of results) {
      console.log(`\n${"─".repeat(60)}`)
      console.log(`⭐ ${r.repoFullName} (${r.stars} stars)`)
      console.log(`   ${r.htmlUrl}`)
      console.log(`   Language: ${r.language ?? "N/A"} | Tags: ${r.tags.join(", ")}`)
      console.log(`   Starred: ${r.starredAt}`)
      console.log(`   ${r.description ?? ""}`)
      console.log(`   AI: ${r.aiAnalysis ?? ""}`)
      console.log(`   Similarity: ${r.similarity}`)
    }

    return results
  })

const showStats = () =>
  Effect.gen(function* () {
    const db = yield* StarDatabase
    const stats = yield* db.getStats()
    console.log(`\n📊 Database Stats:`)
    console.log(`   Total stars: ${stats.total}`)
    console.log(`   Analyzed:    ${stats.analyzed}`)
    console.log(`   Embedded:    ${stats.embedded}`)
  })

// --- CLI ---

const args = process.argv.slice(2)
const command = args[0]

const HELP = `GitHub Stars Organizer

Commands:
  bun src/main.ts sync <username>    Fetch and store GitHub stars
  bun src/main.ts analyze            AI-analyze unprocessed stars
  bun src/main.ts embed              Generate embeddings for search
  bun src/main.ts search <query>     Semantic search your stars
  bun src/main.ts stats              Show database statistics
  bun src/main.ts full <username>    Run sync + analyze + embed

Environment:
  OPENAI_API_KEY    Required for analyze, embed, and search commands
`

// Commands that need only base layer (no OpenAI)
const runBase = (effect: Effect.Effect<void, unknown, GitHubApi | StarDatabase>) =>
  effect.pipe(Effect.provide(BaseLive), Effect.runPromise)

// Commands that need full AI layer
const runFull = (effect: Effect.Effect<void, unknown, GitHubApi | StarDatabase | AiAnalyzer | EmbeddingModel.EmbeddingModel | SemanticSearch>) =>
  effect.pipe(Effect.provide(AppLive), Effect.runPromise)

switch (command) {
  case "sync": {
    const username = args[1]
    if (!username) { console.log(HELP); break }
    runBase(syncStars(username)).catch(console.error)
    break
  }
  case "analyze":
    runFull(analyzeStars()).catch(console.error)
    break
  case "embed":
    runFull(embedStars()).catch(console.error)
    break
  case "search": {
    const query = args.slice(1).join(" ")
    if (!query) { console.log(HELP); break }
    runFull(searchStars(query, 10).pipe(Effect.asVoid)).catch(console.error)
    break
  }
  case "stats":
    runBase(showStats()).catch(console.error)
    break
  case "full": {
    const username = args[1]
    if (!username) { console.log(HELP); break }
    runFull(
      Effect.gen(function* () {
        yield* syncStars(username)
        yield* analyzeStars()
        yield* embedStars()
        yield* showStats()
      })
    ).catch(console.error)
    break
  }
  default:
    console.log(HELP)
}
