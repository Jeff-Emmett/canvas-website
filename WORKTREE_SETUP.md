# Git Worktree Automation Setup

This repository is configured to automatically create Git worktrees for new branches, allowing you to work on multiple branches simultaneously without switching contexts.

## What Are Worktrees?

Git worktrees allow you to have multiple working directories (copies of your repo) checked out to different branches at the same time. This means:

- No need to stash or commit work when switching branches
- Run dev servers on multiple branches simultaneously
- Compare code across branches easily
- Keep your main branch clean while working on features

## Automatic Worktree Creation

A Git hook (`.git/hooks/post-checkout`) is installed that automatically creates worktrees when you create a new branch from `main`:

```bash
# This will automatically create a worktree at ../canvas-website-feature-name
git checkout -b feature/new-feature
```

**Worktree Location Pattern:**
```
/home/jeffe/Github/
├── canvas-website/                    # Main repo (main branch)
├── canvas-website-feature-name/       # Worktree for feature branch
└── canvas-website-bugfix-something/   # Worktree for bugfix branch
```

## Manual Worktree Management

Use the `worktree-manager.sh` script for manual management:

### List All Worktrees
```bash
./scripts/worktree-manager.sh list
```

### Create a New Worktree
```bash
# Creates worktree for existing branch
./scripts/worktree-manager.sh create feature/my-feature

# Or create new branch with worktree
./scripts/worktree-manager.sh create feature/new-branch
```

### Remove a Worktree
```bash
./scripts/worktree-manager.sh remove feature/old-feature
```

### Clean Up All Worktrees (Keep Main)
```bash
./scripts/worktree-manager.sh clean
```

### Show Status of All Worktrees
```bash
./scripts/worktree-manager.sh status
```

### Navigate to a Worktree
```bash
# Get worktree path
./scripts/worktree-manager.sh goto feature/my-feature

# Or use with cd
cd $(./scripts/worktree-manager.sh goto feature/my-feature)
```

### Help
```bash
./scripts/worktree-manager.sh help
```

## Workflow Examples

### Starting a New Feature

**With automatic worktree creation:**
```bash
# In main repo
cd /home/jeffe/Github/canvas-website

# Create and switch to new branch (worktree auto-created)
git checkout -b feature/terminal-tool

# Notification appears:
# 🌳 Creating worktree for branch: feature/terminal-tool
# 📁 Location: /home/jeffe/Github/canvas-website-feature-terminal-tool

# Continue working in current directory or switch to worktree
cd ../canvas-website-feature-terminal-tool
```

**Manual worktree creation:**
```bash
./scripts/worktree-manager.sh create feature/my-feature
cd $(./scripts/worktree-manager.sh goto feature/my-feature)
```

### Working on Multiple Features Simultaneously

```bash
# Terminal 1: Main repo (main branch)
cd /home/jeffe/Github/canvas-website
npm run dev  # Port 5173

# Terminal 2: Feature branch 1
cd /home/jeffe/Github/canvas-website-feature-auth
npm run dev  # Different port

# Terminal 3: Feature branch 2
cd /home/jeffe/Github/canvas-website-feature-ui
npm run dev  # Another port

# All running simultaneously, no conflicts!
```

### Comparing Code Across Branches

```bash
# Use diff or your IDE to compare files
diff /home/jeffe/Github/canvas-website/src/App.tsx \
     /home/jeffe/Github/canvas-website-feature-auth/src/App.tsx

# Or open both in VS Code
code /home/jeffe/Github/canvas-website \
     /home/jeffe/Github/canvas-website-feature-auth
```

### Cleaning Up After Merging

```bash
# After merging feature/my-feature to main
cd /home/jeffe/Github/canvas-website

# Remove the worktree
./scripts/worktree-manager.sh remove feature/my-feature

# Or clean all worktrees except main
./scripts/worktree-manager.sh clean
```

## How It Works

### Post-Checkout Hook

The `.git/hooks/post-checkout` script runs automatically after `git checkout` and:

1. Detects if you're creating a new branch from `main`
2. Creates a worktree in `../canvas-website-{branch-name}`
3. Links the worktree to the new branch
4. Shows a notification with the worktree path

**Hook Behavior:**
- ✅ Creates worktree when: `git checkout -b new-branch` (from main)
- ❌ Skips creation when:
  - Switching to existing branches
  - Already in a worktree
  - Worktree already exists for that branch
  - Not branching from main/master

### Worktree Manager Script

The `scripts/worktree-manager.sh` script provides:
- User-friendly commands for worktree operations
- Colored output for better readability
- Error handling and validation
- Status reporting across all worktrees

## Git Commands with Worktrees

Most Git commands work the same way in worktrees:

```bash
# In any worktree
git status           # Shows status of current worktree
git add .            # Stages files in current worktree
git commit -m "..."  # Commits in current branch
git push             # Pushes current branch
git pull             # Pulls current branch

# List all worktrees (works from any worktree)
git worktree list

# Remove a worktree (from main repo)
git worktree remove feature/branch-name

# Prune deleted worktrees
git worktree prune
```

## Important Notes

### Shared Git Directory

All worktrees share the same `.git` directory (in the main repo), which means:
- ✅ Commits, branches, and remotes are shared across all worktrees
- ✅ One `git fetch` or `git pull` in main updates all worktrees
- ⚠️ Don't delete the main repo while worktrees exist
- ⚠️ Stashes are shared (stash in one worktree, pop in another)

### Node Modules

Each worktree has its own `node_modules`:
- First time entering a worktree: run `npm install`
- Dependencies may differ across branches
- More disk space usage (one `node_modules` per worktree)

### Port Conflicts

When running dev servers in multiple worktrees:
```bash
# Main repo
npm run dev  # Uses default port 5173

# In worktree, specify different port
npm run dev -- --port 5174
```

### IDE Integration

**VS Code:**
```bash
# Open specific worktree
code /home/jeffe/Github/canvas-website-feature-name

# Or open multiple worktrees as workspace
code --add /home/jeffe/Github/canvas-website \
     --add /home/jeffe/Github/canvas-website-feature-name
```

## Troubleshooting

### Worktree Path Already Exists

If you see:
```
fatal: '/path/to/worktree' already exists
```

Remove the directory manually:
```bash
rm -rf /home/jeffe/Github/canvas-website-feature-name
git worktree prune
```

### Can't Delete Main Repo

If you have active worktrees, you can't delete the main repo. Clean up first:
```bash
./scripts/worktree-manager.sh clean
```

### Worktree Out of Sync

If a worktree seems out of sync:
```bash
cd /path/to/worktree
git fetch origin
git reset --hard origin/branch-name
```

### Hook Not Running

If the post-checkout hook isn't running:
```bash
# Check if it's executable
ls -la .git/hooks/post-checkout

# Make it executable if needed
chmod +x .git/hooks/post-checkout

# Test the hook manually
.git/hooks/post-checkout HEAD HEAD 1
```

## Disabling Automatic Worktrees

To disable automatic worktree creation:

```bash
# Remove or rename the hook
mv .git/hooks/post-checkout .git/hooks/post-checkout.disabled
```

To re-enable:
```bash
mv .git/hooks/post-checkout.disabled .git/hooks/post-checkout
```

## Advanced Usage

### Custom Worktree Location

Modify the `post-checkout` hook to change the worktree location:
```bash
# Edit .git/hooks/post-checkout
# Change this line:
WORKTREE_BASE=$(dirname "$REPO_ROOT")

# To (example):
WORKTREE_BASE="$HOME/worktrees"
```

### Worktree for Remote Branches

```bash
# Create worktree for remote branch
git worktree add ../canvas-website-remote-branch origin/feature-branch

# Or use the script
./scripts/worktree-manager.sh create origin/feature-branch
```

### Detached HEAD Worktree

```bash
# Create worktree at specific commit
git worktree add ../canvas-website-commit-abc123 abc123
```

## Best Practices

1. **Clean up regularly**: Remove worktrees for merged branches
2. **Name branches clearly**: Worktree names mirror branch names
3. **Run npm install**: Always run in new worktrees
4. **Check branch**: Always verify which branch you're on before committing
5. **Use status command**: Check all worktrees before major operations

## Resources

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Git Hooks Documentation](https://git-scm.com/docs/githooks)

---

**Setup Complete!** New branches will automatically create worktrees. Use `./scripts/worktree-manager.sh help` for manual management.
