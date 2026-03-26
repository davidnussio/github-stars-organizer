import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform"
import { Effect, Schema, Array as Arr } from "effect"
import { GitHubApiError } from "../domain/errors.js"
import { StarredRepo } from "../domain/schema.js"

const StarredRepoArray = Schema.Array(StarredRepo)

const parseStarredRepos = HttpClientResponse.schemaBodyJson(StarredRepoArray)

export class GitHubApi extends Effect.Service<GitHubApi>()("app/GitHubApi", {
  effect: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient

    const fetchStarredPage = (
      username: string,
      page: number,
      perPage: number = 100
    ) =>
      HttpClientRequest.get(
        `https://api.github.com/users/${username}/starred`
      ).pipe(
        HttpClientRequest.setHeaders({
          Accept: "application/vnd.github.star+json",
          "User-Agent": "github-stars-organizer"
        }),
        HttpClientRequest.setUrlParams({ page: String(page), per_page: String(perPage) }),
        httpClient.execute,
        Effect.flatMap(parseStarredRepos),
        Effect.scoped,
        Effect.mapError(
          (err) => new GitHubApiError({ message: `Failed to fetch stars page ${page}: ${err}` })
        )
      )

    const fetchAllStars = (username: string) =>
      Effect.gen(function* () {
        const allStars: Array<typeof StarredRepo.Type> = []
        let page = 1
        let hasMore = true

        while (hasMore) {
          yield* Effect.log(`Fetching stars page ${page}...`)
          const stars = yield* fetchStarredPage(username, page)
          allStars.push(...stars)
          hasMore = stars.length === 100
          page++
        }

        yield* Effect.log(`Fetched ${allStars.length} starred repos total`)
        return allStars
      })

    const fetchRepoLanguages = (fullName: string) =>
      HttpClientRequest.get(
        `https://api.github.com/repos/${fullName}/languages`
      ).pipe(
        HttpClientRequest.setHeaders({
          "User-Agent": "github-stars-organizer"
        }),
        httpClient.execute,
        Effect.flatMap(HttpClientResponse.schemaBodyJson(
          Schema.Record({ key: Schema.String, value: Schema.Number })
        )),
        Effect.scoped,
        Effect.map((langs) => Object.keys(langs)),
        Effect.catchAll(() => Effect.succeed([] as string[]))
      )

    return { fetchAllStars, fetchRepoLanguages } as const
  })
}) {}
