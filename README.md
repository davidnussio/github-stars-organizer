# github-stars-organizer

AI-powered GitHub stars organizer with semantic search. Built with Effect-TS, SQLite, and OpenAI embeddings.

Syncs your starred repos into a local SQLite database, analyzes each one with GPT-4o-mini to generate summaries and category tags, then creates vector embeddings for semantic search.

## Setup

```bash
bun install
```

Set your OpenAI API key (required for `analyze`, `embed`, and `search` commands):

```bash
export OPENAI_API_KEY=your-key-here
```

## Usage

```bash
# Fetch and store GitHub stars locally
bun src/main.ts sync <username>

# AI-analyze unprocessed stars (generates summaries + tags)
bun src/main.ts analyze

# Generate vector embeddings for semantic search
bun src/main.ts embed

# Semantic search across your stars
bun src/main.ts search <query>

# Show database statistics
bun src/main.ts stats

# Full pipeline: sync → analyze → embed
bun src/main.ts full <username>
```

## Tag Categories

Each repo is automatically classified with 1–3 tags:
`frontend` · `backend` · `devtools` · `ai-ml` · `database` · `infra` · `library` · `other`

## Project Structure

```
src/
  domain/
    schema.ts            GitHub API schemas, TagCategory, StarRecord
    errors.ts            GitHubApiError, DatabaseError, AiAnalysisError, EmbeddingError
  api/
    github.ts            GitHubApi service (fetch stars + repo languages)
  services/
    database.ts          StarDatabase service (SQLite via @effect/sql-sqlite-bun)
    ai-analyzer.ts       AiAnalyzer service (GPT-4o-mini analysis)
    semantic-search.ts   SemanticSearch service (cosine similarity on embeddings)
  layers/
    app-layer.ts         Layer composition (BaseLive for sync/stats, AppLive for AI)
  main.ts                CLI entry point
```

## Cost Estimate

Using OpenAI pricing for `gpt-4o-mini` and `text-embedding-3-small`:

| Stars | Analyze | Embed | Total |
|-------|---------|-------|-------|
| 500   | ~$0.05  | ~$0.001 | ~$0.05 |
| 1000  | ~$0.10  | ~$0.002 | ~$0.10 |
| 5000  | ~$0.50  | ~$0.010 | ~$0.51 |

Search queries cost effectively nothing.

## Tech Stack

- [Effect-TS](https://effect.website) — typed functional programming, DI, error handling
- [Bun](https://bun.sh) — runtime + SQLite driver
- [@effect/sql-sqlite-bun](https://github.com/Effect-TS/effect) — type-safe SQL
- [@effect/ai-openai](https://github.com/Effect-TS/effect) — OpenAI language model + embeddings
