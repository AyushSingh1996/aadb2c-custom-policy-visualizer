# Contributing

Thanks for your interest in improving the project.

## Local setup

```bash
npm install
```

Run the app locally:

```bash
npm run dev:backend
npm run dev:frontend
```

## Verification

Before opening a PR, run:

```bash
npm run build
npm test
```

If you are working in only one package, run the package-specific tests too:

```bash
npm test --workspace=packages/backend
npm test --workspace=packages/frontend
```

## Workflow

- Open or reference a GitHub issue for non-trivial changes
- Keep PRs focused and easy to review
- Include a short explanation of what changed and why
- Add or update tests when behavior changes

## Branch and PR expectations

- Use a descriptive branch name
- Prefer conventional commit messages where practical
- Include validation steps in the PR description

## Mirror model

This public repository is maintained as a curated mirror of the maintainer source repository.

- Accepted public changes are reviewed here first
- Maintainers manually port approved changes back into the source repository
- If a change depends on internal-only planning or operational material, maintainers may adapt it before syncing
