# Operations and Deployment

DeliveryHub is designed for internal deployment and supports local development with Docker and Next.js.

## Local Development
- `npm install`
- `npm run dev`

## Build and Run
- `npm run build`
- `npm run start`

## Docker
- `docker-compose.yml` provides MongoDB and app containers
- Use local auth by default

## Environment Variables
- `AUTH_MODE`
- `AUTH_DISABLE_LOCAL_SIGNUP`
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_CLIENT_SECRET`
- `ENTRA_REDIRECT_URI`
- `ENTRA_SCOPES`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
