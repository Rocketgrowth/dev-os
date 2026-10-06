# Netlify deployment

The repository-root `netlify.toml` builds the application from `contractiq`.

## Secrets scanning

Secrets scanning remains enabled. The build configuration excludes dependency
files under `node_modules` at any depth and explicitly excludes non-sensitive
configuration keys for upload limits, rate limits, and AI model settings. Numeric
configuration values can otherwise match ordinary numbers in source files,
documentation, dependencies, and generated output and fail a successful build.

`OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are deliberately not excluded.
Application source and generated output outside dependency directories remain
scanned for credentials. Do not exclude `.next`, application source, or credential
keys, and do not disable scanning to resolve a credential finding.

Dependency exclusions are limited to false-positive noise; they do not establish
that a credential found in a dependency is harmless. Investigate any genuine
credential finding, remove its source, and rotate exposed credentials.

If a deploy still fails, use its log to identify the flagged key and file. For
non-sensitive configuration, remove its secret designation in Netlify or add its
key to the explicit configuration-only exclusion list. For credentials, fix the
exposure instead. Review site-level and deploy-context scanning overrides if the
effective configuration differs from the repository configuration.
