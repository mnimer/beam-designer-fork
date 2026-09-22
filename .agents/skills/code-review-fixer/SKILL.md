-----
name: code-review-fixer
description: Run as orchestrator, spawning sub-agents to fix everything that was discovered by the code-review skill.
-----

Create a new git worktree first, then I want you to manage the process of fixing the code review problems you've identified in the TASK.md file. 

I want you to spawn sub-agents with the gemini flash model to work on each task, checking in code as they code.  I want you to code review the work the flash model does, before checking in code.  Start the agent to work on the task, review their work, and approve (for checkin) or deny the work and give them guidance on how to fix it.   If they can't. or if you think the problem is tougher than what a flash model can handle, you can do the work instead.  But I need to save your token as much as possible. 