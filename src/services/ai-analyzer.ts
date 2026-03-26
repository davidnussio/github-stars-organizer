import { LanguageModel } from "@effect/ai"
import { Effect, Schema } from "effect"
import { AiAnalysisError } from "../domain/errors.js"
import { TAG_CATEGORIES, type TagCategory } from "../domain/schema.js"

const AnalysisResult = Schema.Struct({
  summary: Schema.String,
  tags: Schema.Array(Schema.String)
})

export class AiAnalyzer extends Effect.Service<AiAnalyzer>()("app/AiAnalyzer", {
  effect: Effect.gen(function* () {
    // Capture LanguageModel at construction time to avoid requirement leakage
    const lm = yield* LanguageModel.LanguageModel

    const analyzeRepo = (repo: {
      repo_full_name: string
      repo_name: string
      description: string | null
      language: string | null
      languages: string | null
      topics: string | null
      stargazers_count: number
    }) =>
      Effect.gen(function* () {
        const topicsStr = repo.topics ? JSON.parse(repo.topics).join(", ") : "none"
        const langsStr = repo.languages ? JSON.parse(repo.languages).join(", ") : repo.language ?? "unknown"

        const prompt = `Analyze this GitHub repository and provide:
1. A concise summary (2-3 sentences) of what this repo does, its use cases, and why it's notable.
2. Assign 1 to 3 tags from EXACTLY these categories: ${TAG_CATEGORIES.join(", ")}

Repository: ${repo.repo_full_name}
Name: ${repo.repo_name}
Description: ${repo.description ?? "No description"}
Languages: ${langsStr}
Topics: ${topicsStr}
Stars: ${repo.stargazers_count}

Respond ONLY with valid JSON in this exact format:
{"summary": "your summary here", "tags": ["tag1", "tag2"]}`

        const response = yield* lm.generateText({ prompt }).pipe(
          Effect.mapError(
            (err) => new AiAnalysisError({ message: `AI analysis failed for ${repo.repo_full_name}: ${err}` })
          )
        )

        const jsonMatch = response.text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          return yield* Effect.fail(
            new AiAnalysisError({ message: `Invalid AI response for ${repo.repo_full_name}: no JSON found` })
          )
        }

        const parsed = yield* Schema.decodeUnknown(AnalysisResult)(
          JSON.parse(jsonMatch[0])
        ).pipe(
          Effect.mapError(
            (err) => new AiAnalysisError({ message: `Failed to parse AI response: ${err}` })
          )
        )

        const validTags = parsed.tags.filter((t): t is TagCategory =>
          TAG_CATEGORIES.includes(t as TagCategory)
        )

        return {
          summary: parsed.summary,
          tags: validTags.length > 0 ? validTags : ["other" as TagCategory]
        }
      })

    return { analyzeRepo } as const
  })
}) {}
