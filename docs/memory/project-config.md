# Project Config — CencomOS Gara v5.2.0

> Config, env vars, deployment reference.

## Environment Variables

### BẮT BUỘC
| Variable | Mô tả | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://postgres:postgres@localhost:5432/cencom` |
| `SESSION_SECRET` | Cookie secret (32+ hex) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### OPTIONAL
| Variable | Default | Mô tả |
|---|---|---|
| `PORT` | `3000` | Next.js port |
| `HOSTNAME` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `development` | production/development |
| `LOG_LEVEL` | `info` | info/warn/error |

### MCP (optional)
| Variable | Default | Mô tả |
|---|---|---|
| `MCP_TRANSPORT` | `stdio` | stdio/http |
| `MCP_HTTP_PORT` | `3001` | HTTP transport port |
| `MCP_USER` | `admin` | Service account |
| `MCP_PASS` | `` | Password |
| `MCP_ROLE` | `giamdoc` | Default role |
| `MCP_WRITE_TOOLS` | `` | Write tools allowlist |
| `MCP_API_KEY` | `` | Bearer token |

## Docker

### Main containers
- `cencom_v5_pg`: postgres:16-alpine, port 5432
- `cencom_v5_web`: Next.js standalone, port 3000
- `cencom_v5_nginx`: nginx:1.27-alpine, ports 80/443

### Useful commands
```bash
cd gara_reconstruction_v5
docker compose up -d          # Start all
docker compose logs -f web    # Follow web logs
docker compose down           # Stop all
```

## Electron
- `electron/main.js`: main process (single-instance, BrowserWindow)
- `electron/preload.js`: contextIsolation, window.versions
- `npm run dev` in `electron/`: concurrently next dev + electron
- `npm run build` in `electron/`: NSIS installer → `dist/CencomOS Gara Setup 5.2.0.exe`

## Key Files
- `lib/rpc.ts`: FN_LIST (85 functions) + META (RBAC)
- `lib/core/*.ts`: 18 domain modules
- `mcp-server/index.ts`: MCP entry point
- `tests/conformance/`: 31 test files, 714 tests
- `db/schema.sql`: PostgreSQL schema
- `db/migrate.ts`: Migration runner
