# Laptop Requirements and First Run

This guide walks through the fastest reliable way to run DeliveryHub locally.

## 1. Install These Tools First

Install the following on your laptop:

- Git
- Node.js 20+ and npm
- Docker Desktop, or Colima if you prefer a lighter local container runtime

### Mac setup

Install these first:

- Git
  - easiest path: install Xcode Command Line Tools
  - command:

```bash
xcode-select --install
```

- Node.js
  - easiest path for most users: install the current Node.js 20+ LTS release from the official Node.js website
  - alternative for developers who already use a package manager:

```bash
brew install node
```

- Docker Desktop
  - install Docker Desktop for Mac from Docker's official site
  - after install, open Docker Desktop once and confirm it is running

### Windows setup

Install these first:

- Git
  - install Git for Windows from the official Git website
  - during install, the default options are usually fine

- Node.js
  - install Node.js 20+ LTS from the official Node.js website

- Docker Desktop
  - install Docker Desktop for Windows from Docker's official site
  - make sure Docker Desktop starts successfully after install
  - if Docker asks for WSL2 integration, enable it

### Colima alternative

If you do not want Docker Desktop, or cannot use it on your laptop, you can use **Colima** instead.

Example startup command:

```bash
colima start --cpu 8 --memory 20 --mount-type virtiofs --disk 50
```

If you use Colima, make sure the Docker CLI is available and points to the Colima-managed runtime before continuing.

### Optional: MongoDB Compass

If you want to inspect local MongoDB collections visually, install **MongoDB Compass**.

This is optional, but it is useful when you want to:

- inspect collections such as `applications`, `work_items`, and `wiki_pages`
- verify bootstrap or sample data
- inspect local records while debugging

Recommended checks after installation:

```bash
node -v
npm -v
docker --version
docker compose version
git --version
```

## 2. Clone the Repository

```bash
git clone <your-repo-url>
cd DeliveryHub
```

## 3. Install Node Dependencies

```bash
npm install
```

## 4. Create `.env.local`

Create a local environment file in the project root.

Minimum local values:

```env
MONGO_URL=mongodb://admin:secretpassword@localhost:27017/delivery?authSource=admin
JWT_SECRET=local-dev-secret
AUTH_MODE=local
AUTH_DISABLE_LOCAL_SIGNUP=false
AUTO_BOOTSTRAP_BASELINE=true
INSTALL_SAMPLE_DATA=false
```

Optional AI variables for local experimentation:

```env
OPENAI_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=
AI_DEFAULT_PROVIDER=OPEN_ROUTER
```

## 5. Start MongoDB

The easiest path is to run MongoDB through Docker Compose:

```bash
docker compose up mongodb -d
```

This starts MongoDB on `localhost:27017`.

If you prefer not to use Docker Compose, the repository also includes a helper script at the project root:

```bash
./run.sh mongo
```

That script starts MongoDB directly with `docker run` and bypasses the compose file.

## 6. Start DeliveryHub

Run the Next.js app locally:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## 7. What Happens on First Startup

On startup, DeliveryHub automatically bootstraps baseline data unless disabled.

That means the app should create or confirm reference data such as:

- taxonomy categories
- document types
- wiki themes
- wiki templates
- diagram templates
- bundles and applications baseline metadata

Sample data is optional and should only be installed when you explicitly want demo content.

## 8. Optional: Start the Whole Stack with Docker Compose

If you want the app container and MongoDB container together:

```bash
docker compose up --build
```

That publishes the app on `http://localhost:3000`.

If you prefer to run the app container without Docker Compose, use:

```bash
./run.sh
```

This builds and runs the DeliveryHub app container directly with `docker run`.

To force a rebuild first:

```bash
./run.sh --rebuild
```

## 9. Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run lint:ci
npm run test:api
npm run db:bootstrap
npm run db:seed-sample
npm run db:reset-sample
```

## 10. Success Checklist

You are ready when all of these are true:

- MongoDB is reachable
- `npm run dev` starts without crashing
- `http://localhost:3000` loads
- you can create or sign in with a local user
- baseline data is visible in the app
