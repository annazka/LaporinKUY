# Branch and publication policy

The user requires all implementation requests to be developed on `uji-coba` first.

- Before editing, verify the current branch and use `uji-coba` in the existing checkout. Preserve existing user changes.
- Commit and push changes to `uji-coba`. Use `git push origin HEAD:uji-coba` to make the destination explicit.
- A routine request to "push" means pushing to `uji-coba`; it does not authorize merging into `main` or publishing production.
- Do not push directly to `main`, merge into `main`, or deploy to production unless the user explicitly asks to promote the reviewed changes to `main` or production.
- Use preview deployments for testing and review. Keep `laporkuy.online` on the production branch `main` until explicit promotion is requested.

# Interface work

Read [DESIGN.md](DESIGN.md) before making interface or copy changes. It records the user's design preferences and the existing interactions that must be preserved.
