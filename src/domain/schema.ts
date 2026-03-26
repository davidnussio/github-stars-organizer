import { Schema } from "effect"

// --- GitHub API response schemas ---

export const GitHubOwner = Schema.Struct({
  login: Schema.String
})

export const GitHubRepo = Schema.Struct({
  id: Schema.Number,
  full_name: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  html_url: Schema.String,
  homepage: Schema.NullOr(Schema.String),
  language: Schema.NullOr(Schema.String),
  stargazers_count: Schema.Number,
  topics: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  owner: GitHubOwner
})
export type GitHubRepo = typeof GitHubRepo.Type

export const StarredRepo = Schema.Struct({
  starred_at: Schema.String,
  repo: GitHubRepo
})
export type StarredRepo = typeof StarredRepo.Type

// --- Tag categories ---

export const TagCategory = Schema.Literal(
  "frontend",
  "backend",
  "devtools",
  "ai-ml",
  "database",
  "infra",
  "library",
  "other"
)
export type TagCategory = typeof TagCategory.Type

export const TAG_CATEGORIES: readonly TagCategory[] = [
  "frontend",
  "backend",
  "devtools",
  "ai-ml",
  "database",
  "infra",
  "library",
  "other"
] as const

// --- Stored star record ---

export const StarRecord = Schema.Struct({
  id: Schema.Number,
  repoFullName: Schema.String,
  repoName: Schema.String,
  description: Schema.NullOr(Schema.String),
  htmlUrl: Schema.String,
  homepage: Schema.NullOr(Schema.String),
  language: Schema.NullOr(Schema.String),
  stargazersCount: Schema.Number,
  topics: Schema.String, // JSON array stored as string
  starredAt: Schema.String,
  aiAnalysis: Schema.NullOr(Schema.String),
  tags: Schema.NullOr(Schema.String), // JSON array of TagCategory
  embedding: Schema.NullOr(Schema.String), // JSON array of numbers
  searchText: Schema.NullOr(Schema.String) // combined text for embedding
})
export type StarRecord = typeof StarRecord.Type
