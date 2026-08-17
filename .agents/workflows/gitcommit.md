---
description: Generate a git message
---

Automatically stage all of the modified files 'git add .', but do not commit.  Write a consolidated git commit message for the changes made to the modified files. Use 'git diff' and the work done in the current session to figure out what has been done in the staged files.

**Critical Rules**
- Never automatically commit code, I want to review changes first. However, if I ask you to commit code, write up a detailed commit message and commit the modified code.
   

- **File References**: When referencing files in the commit message, NEVER use directory paths or file extensions (e.g. use `git-commit workflow` instead of `.agents/workflows/git-commit.md`). The chat UI will aggressively text-replace anything resembling a file path into an uncopyable link.

- **NO LINKS**: NEVER generate markdown links (`[file](...)`), absolute paths, or `cci:` links in the commit message output.

- Print the entire commit message inside a single markdown code block (viz. ` ```text `) to prevent the chat UI from auto-linking paths.