import { SqlClient } from "@effect/sql"
import { Effect } from "effect"
import type { StarredRepo } from "../domain/schema.js"
import { DatabaseError } from "../domain/errors.js"

export class StarDatabase extends Effect.Service<StarDatabase>()("app/StarDatabase", {
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    // Initialize tables
    yield* sql`
      CREATE TABLE IF NOT EXISTS stars (
        id INTEGER PRIMARY KEY,
        repo_full_name TEXT NOT NULL UNIQUE,
        repo_name TEXT NOT NULL,
        description TEXT,
        html_url TEXT NOT NULL,
        homepage TEXT,
        language TEXT,
        languages TEXT, -- JSON array of all languages
        stargazers_count INTEGER NOT NULL,
        topics TEXT, -- JSON array
        starred_at TEXT NOT NULL,
        ai_analysis TEXT,
        tags TEXT, -- JSON array of tag categories
        embedding TEXT, -- JSON array of floats
        search_text TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `.pipe(Effect.mapError((e) => new DatabaseError({ message: `Init table failed: ${e}` })))

    const upsertStar = (star: StarredRepo, languages: readonly string[]) =>
      sql`
        INSERT INTO stars (id, repo_full_name, repo_name, description, html_url, homepage, language, languages, stargazers_count, topics, starred_at)
        VALUES (
          ${star.repo.id},
          ${star.repo.full_name},
          ${star.repo.name},
          ${star.repo.description},
          ${star.repo.html_url},
          ${star.repo.homepage},
          ${star.repo.language},
          ${JSON.stringify(languages)},
          ${star.repo.stargazers_count},
          ${JSON.stringify(star.repo.topics)},
          ${star.starred_at}
        )
        ON CONFLICT(repo_full_name) DO UPDATE SET
          description = excluded.description,
          stargazers_count = excluded.stargazers_count,
          topics = excluded.topics,
          languages = excluded.languages,
          updated_at = datetime('now')
      `.pipe(Effect.mapError((e) => new DatabaseError({ message: `Upsert failed: ${e}` })))

    const updateAiAnalysis = (repoFullName: string, analysis: string, tags: readonly string[]) =>
      sql`
        UPDATE stars
        SET ai_analysis = ${analysis},
            tags = ${JSON.stringify(tags)},
            search_text = description || ' ' || ${analysis},
            updated_at = datetime('now')
        WHERE repo_full_name = ${repoFullName}
      `.pipe(Effect.mapError((e) => new DatabaseError({ message: `Update AI analysis failed: ${e}` })))

    const updateEmbedding = (repoFullName: string, embedding: readonly number[]) =>
      sql`
        UPDATE stars
        SET embedding = ${JSON.stringify(embedding)},
            updated_at = datetime('now')
        WHERE repo_full_name = ${repoFullName}
      `.pipe(Effect.mapError((e) => new DatabaseError({ message: `Update embedding failed: ${e}` })))

    const getStarsWithoutAnalysis = () =>
      sql<{
        repo_full_name: string
        repo_name: string
        description: string | null
        language: string | null
        languages: string | null
        topics: string | null
        stargazers_count: number
        html_url: string
      }>`
        SELECT repo_full_name, repo_name, description, language, languages, topics, stargazers_count, html_url
        FROM stars WHERE ai_analysis IS NULL
      `.pipe(Effect.mapError((e) => new DatabaseError({ message: `Query failed: ${e}` })))

    const getStarsWithoutEmbedding = () =>
      sql<{
        repo_full_name: string
        search_text: string | null
        description: string | null
      }>`
        SELECT repo_full_name, search_text, description
        FROM stars WHERE embedding IS NULL AND search_text IS NOT NULL
      `.pipe(Effect.mapError((e) => new DatabaseError({ message: `Query failed: ${e}` })))

    const getAllStarsWithEmbeddings = () =>
      sql<{
        repo_full_name: string
        repo_name: string
        description: string | null
        ai_analysis: string | null
        tags: string | null
        language: string | null
        languages: string | null
        starred_at: string
        embedding: string | null
        html_url: string
        stargazers_count: number
      }>`
        SELECT repo_full_name, repo_name, description, ai_analysis, tags, language, languages, starred_at, embedding, html_url, stargazers_count
        FROM stars WHERE embedding IS NOT NULL
      `.pipe(Effect.mapError((e) => new DatabaseError({ message: `Query failed: ${e}` })))

    const getStats = () =>
      sql<{ total: number; analyzed: number; embedded: number }>`
        SELECT
          COUNT(*) as total,
          COUNT(ai_analysis) as analyzed,
          COUNT(embedding) as embedded
        FROM stars
      `.pipe(
        Effect.map((rows) => rows[0] ?? { total: 0, analyzed: 0, embedded: 0 }),
        Effect.mapError((e) => new DatabaseError({ message: `Stats query failed: ${e}` }))
      )

    return {
      upsertStar,
      updateAiAnalysis,
      updateEmbedding,
      getStarsWithoutAnalysis,
      getStarsWithoutEmbedding,
      getAllStarsWithEmbeddings,
      getStats
    } as const
  })
}) {}
