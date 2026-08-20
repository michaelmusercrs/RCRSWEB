# Deployment Policy — rcrs-portal

**Production is deployed by pushing to `main`. Nothing else.**

Vercel is connected to `michaelmusercrs/RCRSWEB` and auto-deploys the `main`
branch to production (serving both `rcrsal.com` → `/portal` and
`www.rivercityroofingsolutions.com`). A push to `main` builds and goes live
automatically.

## The one workflow

```bash
# make your change on a branch or on main
git add -A && git commit -m "what changed"
git checkout main && git merge --ff-only <your-branch>   # if you used a branch
git push origin main                                     # ← this deploys
```

That's it. Watch the deploy in the Vercel dashboard.

## Do NOT do this

- ❌ **`vercel --prod` from a working tree.** Manual CLI deploys ship whatever
  is on disk — including uncommitted or *older* code — and **overwrite the
  git-deployed production**, moving the live site backward and drifting it away
  from `main`. This is the single biggest source of "my fix disappeared."
- ❌ Deploying from a detached worktree or a stale branch.
- ❌ Leaving fixes uncommitted. If it isn't committed and pushed to `main`, it
  is not deployed and will be lost.

## If a hotfix is truly urgent

Commit it, push to `main`, and let the auto-deploy run. It is not slower than a
CLI deploy and it keeps git = production. If Vercel is down, use
`vercel --prod` **only** from a clean, committed checkout of `main`
(`git status` shows nothing), never from a dirty tree.

## Rollback

Use the Vercel dashboard → Deployments → pick a known-good production
deployment → "Promote to Production" (or "Rollback"). Do not fix-forward with a
dirty CLI deploy.
