# Pipeline

Automated data pipeline that fetches Jira stories and sends them to a target API.

## API Migration

### Jira Search Endpoint

The pipeline previously used the deprecated Jira Cloud endpoint:

```
GET /rest/api/3/search?jql={query}
```

This endpoint was removed by Atlassian and returns `410 Gone`. The error message indicates:
> The requested API has been removed. Please migrate to the `/rest/api/3/search/jql` API.

The pipeline now uses the supported replacement:

```
POST /rest/api/3/search/jql
```

With the JQL query and requested fields sent as a JSON body:

```json
{
  "jql": "project=PT AND labels=ai-ready AND status=\"To Do\"",
  "fields": ["summary", "status", "priority", "assignee", "labels", "created", "updated"],
  "maxResults": 50
}
```

This migration was completed in the initial commit of this repository.

## Bug Fixes

### `ReferenceError: transformData is not defined`

The `module.exports` block exported `transformData` and `sendToTarget`, but neither function was defined in the file. This caused a `ReferenceError` on startup.

**Fix:** Added proper function definitions for:
- `transformData(issues)` — maps raw Jira issue objects into a clean payload format
- `sendToTarget(data)` — POSTs the transformed payload to the configured target API

### `fetchFromSource` Error Logging

The original `fetchFromSource` had no structured error handling. API failures surfaced only as generic messages like `Request failed with status code 410`.

**Fix:** Wrapped the Axios call in a `try/catch` block that logs:
- The HTTP status code and status text
- The full JSON response body from Jira

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure `.env`:
   ```
   JIRA_DOMAIN=your-domain.atlassian.net
   JIRA_EMAIL=your-email@example.com
   JIRA_TOKEN=your-atlassian-api-token
   JIRA_PROJECT=PROJECT_KEY
   ```

3. Run the pipeline:
   ```bash
   node pipeline.js
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JIRA_DOMAIN` | Atlassian domain (e.g., `clustox.atlassian.net`) | — |
| `JIRA_EMAIL` | Jira account email | — |
| `JIRA_TOKEN` | Atlassian API token | — |
| `JIRA_PROJECT` | Project key to query | — |
| `TARGET_API_URL` | Target API base URL | `https://httpbin.org` |
| `CRON_SCHEDULE` | Cron expression for periodic runs | `*/5 * * * *` |

## License

MIT
