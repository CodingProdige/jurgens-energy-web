# Piessang Notification System

Piessang treats notifications as platform events. A single event can produce an
in-app notification, an email, and a web push notification.

## Event entry point

Use the central dispatcher instead of calling channel-specific senders directly:

```ts
await notify({
  event: "seller.application.submitted",
  recipientUserId,
  data: { storeName },
});
```

The dispatcher loads the event delivery policy, merges global template
variables, then sends only the enabled channels.

## Delivery policy

Each notification event has one policy:

- `inAppEnabled`: create a bell notification.
- `emailEnabled`: send the matching SendGrid email template.
- `pushEnabled`: send a browser push notification when the recipient has opted in.
- `priority`: `low`, `normal`, `high`, or `critical`.
- `quietHoursEnabled`, `quietHoursStart`, `quietHoursEnd`: hold non-critical
  sends during quiet hours.
- `digestEligible`: allows future batching into digest emails.

Rule of thumb:

- In-app only: low urgency dashboard context.
- Email only: receipts, legal, and formal records.
- In-app + email: important workflow/account events.
- In-app + push: time-sensitive operational alerts.
- All channels: rare critical events.

## Push notifications

Browser push is wired as a real delivery channel.

Configured pieces:

- `public/sw.js` handles `push` and `notificationclick`.
- `/api/notifications/push/public-key` exposes the public VAPID key.
- `/api/notifications/push/subscriptions` saves and revokes browser subscriptions.
- `push_notification_subscriptions` stores subscriptions per user and surface.
- `notify()` sends web push when the template delivery policy enables it.
- Expired subscriptions are revoked automatically when the push provider returns
  `404` or `410`.

Required environment variables:

- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`

`WEB_PUSH_PUBLIC_KEY` may also be provided as
`NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, but the app reads it from the server route so
self-hosted env changes stay centralized.

Generate keys with:

```sh
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Use a subject you control, for example:

```txt
WEB_PUSH_SUBJECT=mailto:no-reply@piessang.com
```

Still planned:

- user-level notification preferences
- quiet-hour scheduling instead of immediate skip/delivery decisions
- digest batching through Redis/job queues
