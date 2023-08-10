# Second Spectrum REST API Client

this is the Atlanta Hawks fork of the `second-spectrum` rest api client.

## motivation

two things prompted forking the repo for our own build:

1. avoid hard-coding credentials in `src/auth.ts`, instead leverage env vars for the same purpose

2. add an option to stream the file contents remotely to a gcp bucket rather than saving to a local filesystem

those changes are reflected in the file `src/2s.ts`, which otherwise started as a clone of `src/rest.ts`.

## distribution

changes to this codebase should be put through a standard PR process. on merge to `main`, the cd pipeline will build and package the binary and then push it to our `artifacts` project in gcp to a public bucket.

## differences

### `husky`

husky was installed to help add guardrails around committing and pushing code:

```cmd
$ npx husky install

$ npx husky add .husky/commit-msg "npm run prettier && npm run lint"
```
