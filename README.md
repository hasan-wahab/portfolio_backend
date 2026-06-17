# hasanwahab-portfolio-backend

Alag folder — **portfolio CMS REST API**. `data/portfolio.json` stores the **full** `PortfolioContent` document (same JSON the Flutter app + admin use).

## Layout (clean architecture)

| Path | Role |
|------|------|
| `src/server.js` | HTTP listen |
| `src/app.js` | Express app, CORS, JSON body, routes |
| `src/config/index.js` | `PORT`, `ADMIN_TOKEN`, `DATA_FILE`, dotenv |
| `src/repositories/filePortfolioRepository.js` | Read/write `data/portfolio.json` |
| `src/services/portfolioService.js` | `getFullDocument` / `replaceFullDocument` |
| `src/middleware/requireAdminToken.js` | Bearer check for **PUT** |
| `src/controllers/portfolioController.js` | GET/PUT handlers |
| `src/routes/portfolioRoutes.js` | `GET /`, `PUT /` mounted at `/api/portfolio` |

## API

- **GET** `/api/portfolio` — public, full JSON  
- **PUT** `/api/portfolio` — replace full JSON, header `Authorization: Bearer <ADMIN_TOKEN>`  
- **GET** `/health` — liveness  

## Setup

```powershell
cd C:\Users\DELL\StudioProjects\hasanwahab-portfolio-backend
copy .env.example .env
```

`.env` mein `ADMIN_TOKEN` ko lamba random string set karo.

```powershell
npm install
npm start
```

- **Health:** `GET http://127.0.0.1:8787/health`
- **Public read:** `GET http://127.0.0.1:8787/api/portfolio`
- **Admin save:** `PUT http://127.0.0.1:8787/api/portfolio`  
  Header: `Authorization: Bearer <ADMIN_TOKEN>`  
  Body: poora portfolio JSON object (jo file mein save hona chahiye)

## Flutter app

Sister repo: `hasanwahab` (Flutter). Startup par JSON load:

```powershell
flutter run --dart-define=PORTFOLIO_API_URL=http://127.0.0.1:8787
```

- `PORTFOLIO_API_URL` khali = app bundled dummy use karti hai (offline).
- Android emulator → host: `http://10.0.2.2:8787` try karein.

**Admin UI:** `hasanwahab-portfolio-admin` — `npm run dev` (port `5174`), wahan se `PUT` se yahi file update hoti hai.

**Seed file** dummy ke barabar karne ke liye Flutter repo se:

```powershell
cd ..\hasanwahab
flutter test test/export_portfolio_seed_test.dart
```

## Security (production)

- `ADMIN_TOKEN` strong rakho, HTTPS use karo, rate limit / IP allowlist add karo.
- `portfolio.json` ko `.gitignore` mein mat rakho agar team ko seed chahiye — secrets file mein hi rakho.
