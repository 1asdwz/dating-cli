# dating-cli

npm-based Dating API command-line wrapper for direct AI/Agent invocation.

## 1. Installation

Install dependencies locally in this directory:

Global installation (development machine):

```bash
npm install -g dating-cli
dating-cli --help
```

## 2. Configuration

Default config file path: `~/.dating-cli/config.json`

```bash
dating-cli config show
```

After successful `task create|get|update|stop`, the latest task state is automatically saved:

- `lastTask` (object containing `taskId/taskName/status/matchStatus/resultVersion/operation/updatedAt`)
- `lastTaskId`
- `lastTaskStatus`
- `lastTaskMatchStatus`
- `lastTaskOperation`
- `lastTaskUpdatedAt`

Auth state is also persisted automatically:

- `register` / `login` always save `token/tokenHead/memberId/username`
- `logout` always clears local auth fields and writes the config

Environment variables are also supported:

- `DATING_API_TOKEN`
- `DATING_API_TOKEN_HEAD`
- `DATING_API_CONFIG`

## 3. Typical Workflow

### 3.1 Register (token auto-saved)

```bash
dating-cli register
```

To try a specific username first:

```bash
dating-cli register --username alice
```

### 3.2 Login (token auto-saved)

```bash
dating-cli login --username demo_user --password demo_pass
```

### 3.3 Logout and clear local token

```bash
dating-cli logout
```

### 3.4 Upload image to MinIO

```bash
dating-cli upload "./photos/me-1.jpg" "./photos/me-2.jpg"
```

This command uploads each file via `POST /minio/upload`, then automatically calls `PUT /member-profile` with `photoUrls` array.
Returned URLs are in top-level `photoUrls`.

### 3.5 Update profile

```bash
dating-cli profile update \
  --gender Male \
  --character-text "gentle,introverted" \
  --hobby-text "sports" \
  --ability-text "basketball" \
  --city Shanghai \
  --photo-url "https://cdn.example.com/photos/me-1.jpg" \
  --photo-url "https://cdn.example.com/photos/me-2.jpg" \
  --email "amy@example.com" \
  --whatsapp "85260000000"
```

For profile images, prefer `dating-cli upload <filePaths...>` to upload and update `photoUrls` in one step.

### 3.6 Create task

```bash
dating-cli task create \
  --task-name "Find female match" \
  --preferred-gender-filter '{"eq":"Female"}' \
  --preferred-city-filter '{"eq":"Shanghai"}' \
  --preferred-height-filter '{"gte":165,"lte":180}' \
  --intention "serious relationship" \
  --intention-embedding-min-score 0.70
```

If `--*-embedding-min-score` is omitted on `task create`, backend default is `0.1`.

Update by taskId:

```bash
dating-cli task update 12 \
  --task-name "Updated criteria" \
  --preferred-gender-filter '{"eq":"Female"}' \
  --preferred-city-filter '{"eq":"Hangzhou"}' \
  --intention "long-term relationship"
```

### 3.7 Single check

```bash
dating-cli check 12
```

Check a specific page (10 candidates per page):

```bash
dating-cli check 12 --page 2
```

### 3.8 Re-check until matched

```bash
dating-cli check 12
```

Re-check when unmatched 

### 3.9 Reveal contact after match

```bash
dating-cli reveal-contact 201
```

### 3.10 Submit review

```bash
dating-cli review 201 --rating 5 --comment "Great communication"
```

## 4. Main Commands

- `dating-cli register`
- `dating-cli login`
- `dating-cli logout`
- `dating-cli config path|show|set-token|clear-token`
- `dating-cli upload <filePaths...>`
- `dating-cli profile update`
- `dating-cli task create|get|update|stop`
- `dating-cli check`
- `dating-cli reveal-contact`
- `dating-cli review`
- `dating-cli admin violation-review`
- `dating-cli admin ranking-get`
- `dating-cli admin ranking-set`

## 5. Parameter Input

- `dating-cli` now uses direct command-line parameters only.
- `--json` / `--json-file` / `--criteria-json` / `--criteria-file` are no longer supported.
- Task criteria filter options use GraphQL filter JSON object strings (for example `--preferred-gender-filter '{"eq":"female"}'`).
- Use `--help` on each command to view all supported direct options.

## 6. Output Format

Default output is JSON for easy parsing by upstream AI.

Error response:

```json
{
  "ok": false,
  "error": {
    "message": "...",
    "status": 500,
    "payload": {}
  }
}
```
