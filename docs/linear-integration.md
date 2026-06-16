# Linear Integration

Repruvia creates issues via the [Linear GraphQL API](https://developers.linear.app/docs).

## Setup

1. Create an OAuth application at **Linear → Settings → API → OAuth applications**.
2. Set the redirect URI to your Repruvia web app origin (e.g. `http://localhost:3000/settings`).
3. Copy the **Client ID** into `VITE_LINEAR_CLIENT_ID` in `.env.local`.

## What gets created

- An issue on your selected team with the report title, severity → priority mapping, and the full Markdown body as the description.
- Screenshots and the session video are uploaded via Linear's `fileUpload` mutation and attached to the issue.

## Severity → Priority mapping

| Repruvia severity | Linear priority |
| --- | --- |
| Critical | 1 (Urgent) |
| High | 2 (High) |
| Medium | 3 (Medium) |
| Low | 4 (Low) |
