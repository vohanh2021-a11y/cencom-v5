# Chat Page Design Override

**Page:** `/chat`
**Theme:** Calm
**Priority:** High (communication)

## Layout

- Sidebar (desktop) or dropdown: thread list with unread badges
- Main chat area: messages scroll, input at bottom
- Image upload: preview thumbnail before send

## Color Overrides

- Unread badge: `var(--c-accent)` red dot + count
- Message bubbles: sent = amber tint, received = gray tint
- Input area: white surface, border top

## Typography

- Messages: `var(--text-sm)` body
- Timestamps: `var(--text-xs)` muted
- Thread name: `var(--text-sm)` semibold

## Components

- Message input: textarea + send button + image upload
- Avatar: gradient green circle (initials)
- Typing indicator: "đang gõ..." with ellipsis
- Image preview: thumbnail with × remove button

## Pre-Existing Notes

- Chat core nhận 1 object `rec` (không positional)
- `chatList`, `chatThreads`, `chatSend({to, body})`
- `chatSendImg({to, img})`, `chatDeleteMsg({id})`
- `useRealtime('chat_messages')` for updates
- RBAC chat gating
- Storage bucket for images
