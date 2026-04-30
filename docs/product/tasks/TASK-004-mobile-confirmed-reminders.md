# TASK-004: Mobile Confirmed Reminders

## Outcome
Confirmed reminder proposals become reliable local scheduled notifications on Android.

## Type
Frontend

## Acceptance Criteria
- [ ] The app requests notification permission before scheduling the first reminder.
- [ ] Given a reminder proposal with a future time, when the user confirms it, then the app saves it locally and schedules a local notification.
- [ ] Given a reminder is edited or deleted, when the change is saved, then the scheduled notification is updated or cancelled.
- [ ] Given notification permission is denied, when the user confirms a reminder, then the app saves it locally and explains that notifications are disabled.
- [ ] Reminder scheduling is tested on at least one real Android device.

## Implementation Notes
- Use local scheduled notifications for MVP; do not add push reminders.
- Store notification identifiers locally so reminders can be updated or cancelled.
- Treat exact reminder reliability as a release risk until tested under Android battery restrictions.

## Dependencies
- `TASK-003-mobile-local-data-and-chat-shell.md`

## Verification
- Manual Android flow: create, receive, edit, and cancel a reminder notification.
