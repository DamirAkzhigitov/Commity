# Git Workflow

Use Git from the project root, not from `apps/mobile`, because this is a
monorepo with mobile, API, shared packages, and docs.

## Recommended Checkpoints

Commit after each working slice:

1. Expo mobile bootstrap.
2. Backend API bootstrap.
3. Shared schemas and database model.
4. Auth integration.
5. OpenAI bridge and usage tracking.
6. Google Play Billing verification.
7. Tasks, notes, reminders, and local notifications.
8. Memory and proactive reminders.

## Suggested Commands

```bash
cd /home/xiao/Documents/Projects/PersonalAssistant
git init
git add .
git commit -m "Initialize personal assistant MVP scaffold"
```

If `apps/mobile` has its own `.git` directory from `create-expo-app`, remove that
nested Git metadata before the first root commit so the mobile app is tracked as
normal project files:

```bash
rm -rf apps/mobile/.git
```

Do not commit `.env`, API keys, service account JSON, Android keystores, or Play
Console credentials.
