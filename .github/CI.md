# Main branch quality gate

`FoodRescue CI` runs on every pull request into `main`, every push to `main`, merge-queue groups, and manual dispatch. Its single stable required check is **FoodRescue quality gate**.

The job fails for unresolved Git index conflicts, leftover conflict markers in tracked text (including diff3 markers), failing Node regression tests, dependency-lock installation errors, frontend build errors, and backend/shared TypeScript build errors. Pull requests run against GitHub's proposed merge result. GitHub also blocks merging a pull request whose branches cannot be merged cleanly.

Run locally:

```sh
npm ci
npm run check:conflicts
npm test
npm run build
```

## Required repository-owner configuration

A workflow alone reports failures; it cannot block direct writes to `main`. A repository administrator must enable branch protection or a ruleset in Settings → Branches/Rules:

1. Target `main` and require a pull request before merging (zero required reviews is sufficient for this quality gate).
2. Require **FoodRescue quality gate** from GitHub Actions to pass.
3. Require branches to be up to date before merging.
4. Include administrators, prevent bypass, and keep force pushes/deletion disabled.
5. Save and verify by opening a failing test PR. The check may appear in the picker after its first workflow run.

Settings: https://github.com/qgelgarcia/FoodRescue/settings/branches

The account used for setup has push permission but no admin permission. The workflow can be installed, but an administrator must activate the merge-blocking settings above. No protection was disabled or weakened.

No deployment destination was supplied, so this workflow is the CI quality gate, not automatic hosting or database deployment. It does not use production secrets or run migrations. Passing these checks does not guarantee absence of runtime, security, or device-specific bugs.
