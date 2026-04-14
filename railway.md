# PhotoSync - Railway Deployment

This project has two components that need to be deployed separately:

## Backend (API)
- Directory: `/backend`
- Runtime: Python
- Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

## Frontend (Web App)
- Directory: `/frontend`
- Runtime: Node.js
- Build command: `yarn build`
- Start command: `npx serve build -l $PORT`
