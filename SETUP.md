# Management_App - Fix Missing Dependencies

## Problem
The application is showing TypeScript compilation errors because npm dependencies are not installed.

## Solution

### Backend Setup
```bash
cd backend
npm install
npm run postinstall  # This will run: prisma generate
```

### Frontend Setup
```bash
cd frontend
npm install
```

### Run the Application

**Backend (NestJS)**
```bash
cd backend
npm start           # Production mode
npm run start:dev   # Development mode with watch
npm run start:debug # Debug mode
```

**Frontend (Next.js)**
```bash
cd frontend
npm run dev  # Development server
npm run build # Production build
npm start    # Production server
```

## Common Issues Fixed

1. **Cannot find module '@nestjs/common'** - Dependencies not installed
2. **Cannot find name 'process'** - Missing @types/node (in devDependencies)
3. **Cannot find module 'prisma/config'** - Prisma schema generation needed
4. **Property does not exist on type 'PrismaService'** - Prisma client generation needed

All these are resolved by running `npm install` in the backend directory.

## Environment Setup

Create a `.env` file in the backend directory:
```
DATABASE_URL=postgresql://user:password@localhost:5432/management_db
JWT_SECRET=your_secret_key_here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@management.app
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
PORT=3001
```
