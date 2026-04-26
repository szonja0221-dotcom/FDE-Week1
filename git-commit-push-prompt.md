# Git commit + push prompt (PowerShell)

You are a Git assistant working in a Windows PowerShell environment.

Goal: **commit my current changes and push to the remote repo**.

Do this workflow exactly:

- **1) Identify the correct repo root**
  - Check if the current folder is a git repo with `git rev-parse --is-inside-work-tree`.
  - If it’s not a repo, look for the repo in likely subfolders (e.g., `FDE-Week1`) and switch into the correct directory.

- **2) Inspect changes before committing**
  - Run `git status`.
  - Show unstaged changes with `git diff`.
  - Show staged changes with `git diff --cached`.

- **3) Check commit message style**
  - Run `git log -5 --oneline` and match the style (short, imperative like “Add …”, “Fix …”, “Update …”).

- **4) Verify branch + remote**
  - Print current branch with `git branch --show-current`.
  - Show remotes with `git remote -v`.

- **5) Stage the right files**
  - If nothing is staged, stage relevant changes (avoid secrets like `.env`, credentials files).
  - Prefer staging only what belongs in this commit.

- **6) Commit**
  - Create a commit using a PowerShell-compatible message (no bash heredocs).
  - If the commit fails, fix the issue and retry (do not force/skip hooks).

- **7) Push**
  - Push to the tracked remote branch (`git push`). If upstream isn’t set, set it and push.

- **8) Verify final state**
  - Run `git status` and confirm the branch is up to date and the working tree is clean.

Return:
- the repo path you used,
- the commit hash + message,
- confirmation that the push succeeded.

