#!/bin/bash
#
# Worktree Manager - Helper script for managing Git worktrees
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_NAME=$(basename "$REPO_ROOT")
WORKTREE_BASE=$(dirname "$REPO_ROOT")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

show_help() {
    cat << EOF
${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
${GREEN}Worktree Manager${NC} - Manage Git worktrees easily
${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

${YELLOW}Usage:${NC}
  ./worktree-manager.sh <command> [arguments]

${YELLOW}Commands:${NC}
  ${GREEN}list${NC}             List all worktrees
  ${GREEN}create${NC} <branch>  Create a new worktree for a branch
  ${GREEN}remove${NC} <branch>  Remove a worktree
  ${GREEN}clean${NC}            Remove all worktrees except main
  ${GREEN}goto${NC} <branch>    Print command to cd to worktree
  ${GREEN}status${NC}           Show status of all worktrees
  ${GREEN}help${NC}             Show this help message

${YELLOW}Examples:${NC}
  ./worktree-manager.sh create feature/new-feature
  ./worktree-manager.sh list
  ./worktree-manager.sh remove feature/old-feature
  ./worktree-manager.sh clean
  cd \$(./worktree-manager.sh goto feature/new-feature)

${YELLOW}Automatic Worktrees:${NC}
  A Git hook is installed that automatically creates worktrees
  when you run: ${CYAN}git checkout -b new-branch${NC}

${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
EOF
}

list_worktrees() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Git Worktrees:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    cd "$REPO_ROOT"
    git worktree list --porcelain | awk '
        /^worktree/ { path=$2 }
        /^HEAD/ { head=$2 }
        /^branch/ {
            branch=$2
            gsub(/^refs\/heads\//, "", branch)
            printf "%-40s %s\n", branch, path
        }
        /^detached/ {
            printf "%-40s %s (detached)\n", head, path
        }
    ' | while read line; do
        if [[ $line == *"(detached)"* ]]; then
            echo -e "${YELLOW}  $line${NC}"
        else
            echo -e "${GREEN}  $line${NC}"
        fi
    done

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

create_worktree() {
    local branch=$1

    if [ -z "$branch" ]; then
        echo -e "${RED}Error: Branch name required${NC}"
        echo "Usage: $0 create <branch-name>"
        exit 1
    fi

    local worktree_path="${WORKTREE_BASE}/${REPO_NAME}-${branch}"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Creating worktree for branch: ${YELLOW}$branch${NC}"
    echo -e "${BLUE}Location: ${YELLOW}$worktree_path${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    cd "$REPO_ROOT"

    # Check if branch exists
    if git show-ref --verify --quiet "refs/heads/$branch"; then
        # Branch exists, just create worktree
        git worktree add "$worktree_path" "$branch"
    else
        # Branch doesn't exist, create it
        echo -e "${YELLOW}Branch doesn't exist, creating new branch...${NC}"
        git worktree add -b "$branch" "$worktree_path"
    fi

    echo -e "${GREEN}✅ Worktree created successfully!${NC}"
    echo -e ""
    echo -e "To switch to the worktree:"
    echo -e "  ${CYAN}cd $worktree_path${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

remove_worktree() {
    local branch=$1

    if [ -z "$branch" ]; then
        echo -e "${RED}Error: Branch name required${NC}"
        echo "Usage: $0 remove <branch-name>"
        exit 1
    fi

    cd "$REPO_ROOT"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Removing worktree for branch: $branch${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    git worktree remove "$branch" --force

    echo -e "${GREEN}✅ Worktree removed successfully!${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

clean_worktrees() {
    cd "$REPO_ROOT"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Cleaning up worktrees (keeping main/master)...${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Get list of worktrees excluding main/master
    git worktree list --porcelain | grep "^branch" | sed 's/^branch refs\/heads\///' | while read branch; do
        if [[ "$branch" != "main" ]] && [[ "$branch" != "master" ]]; then
            echo -e "${YELLOW}Removing: $branch${NC}"
            git worktree remove "$branch" --force 2>/dev/null || echo -e "${RED}  Failed to remove $branch${NC}"
        fi
    done

    # Prune deleted worktrees
    git worktree prune

    echo -e "${GREEN}✅ Cleanup complete!${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

goto_worktree() {
    local branch=$1

    if [ -z "$branch" ]; then
        echo -e "${RED}Error: Branch name required${NC}" >&2
        exit 1
    fi

    cd "$REPO_ROOT"

    # Find worktree path for branch
    local worktree_path=$(git worktree list --porcelain | awk -v branch="$branch" '
        /^worktree/ { path=$2 }
        /^branch/ {
            b=$2
            gsub(/^refs\/heads\//, "", b)
            if (b == branch) {
                print path
                exit
            }
        }
    ')

    if [ -n "$worktree_path" ]; then
        echo "$worktree_path"
    else
        echo -e "${RED}Error: No worktree found for branch '$branch'${NC}" >&2
        exit 1
    fi
}

show_status() {
    cd "$REPO_ROOT"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Worktree Status:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    git worktree list --porcelain | awk '
        /^worktree/ { path=$2 }
        /^branch/ {
            branch=$2
            gsub(/^refs\/heads\//, "", branch)
            printf "\n%s%s%s\n", "Branch: ", branch, ""
            printf "%s%s%s\n", "Path:   ", path, ""
            system("cd " path " && git status --short --branch | head -5")
        }
    ' | while IFS= read -r line; do
        if [[ $line == Branch:* ]]; then
            echo -e "${GREEN}$line${NC}"
        elif [[ $line == Path:* ]]; then
            echo -e "${BLUE}$line${NC}"
        else
            echo -e "${YELLOW}$line${NC}"
        fi
    done

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Main command dispatcher
case "${1:-help}" in
    list|ls)
        list_worktrees
        ;;
    create|add)
        create_worktree "$2"
        ;;
    remove|rm|delete)
        remove_worktree "$2"
        ;;
    clean|cleanup)
        clean_worktrees
        ;;
    goto|cd)
        goto_worktree "$2"
        ;;
    status|st)
        show_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
