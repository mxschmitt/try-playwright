# Contributation guide

## Overview

The project is split into `frontend` (React with Monaco editor embedded) and `backend` (webserver with Express that runs the input isolated) which are located in the directories with the same names. Both are written fully in TypeScript and share their types from the root `types` directory. 

For linting purposes ESLint is in the root directory configured. 

## Development environment

For running everything locally with auto-reload functionality the following setup is recommended:
- frontend: `npm run start` - starts the React development server
- backend: `npm run dev-tsc` - starts the TypeScript compiler in watch mode
- backend: `npm run dev-dev` - starts the Express server with auto-reload using `nodemon`
