# Jira Integration

Repruvia creates issues via the [Jira REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/).

## Setup

1. Create an OAuth 2.0 (3LO) app at [developer.atlassian.com](https://developer.atlassian.com/), or generate a personal **API token** for quick local use.
2. Configure `VITE_JIRA_CLIENT_ID` in `.env.local` (OAuth flow), or paste an API token in the Repruvia **Settings** page.
3. Repruvia resolves your `cloudId` automatically from the accessible-resources endpoint.

## What gets created

- A `Bug` issue in your selected project. The Markdown body is converted to Atlassian Document Format (ADF).
- Screenshots and the video are uploaded to `/rest/api/3/issue/{issueId}/attachments`.

## Severity → Priority mapping

| Repruvia severity | Jira priority |
| --- | --- |
| Critical | Highest |
| High | High |
| Medium | Medium |
| Low | Low |
