# 🔧 Fixing Missing Dependencies

## The Problem

Your project is showing TypeScript compilation errors because npm dependencies are not installed. The errors include:

- `Cannot find module '@nestjs/common'`
- `Cannot find name 'process'`
- `Cannot find module '@prisma/client'`
- Property errors on `PrismaService`

## The Solution

### Option 1: Automatic Installation (Recommended)

```bash
chmod +x install-dependencies.sh
./install-dependencies.sh
```

### Option 2: Manual Installation

```bash
# Backend
cd backend
npm install
npm run postinstall  # Generates Prisma client

# Frontend
cd frontend
npm install
```

## Environment Configuration

Create a `.env` file in the `backend` directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/management_db

# JWT
JWT_SECRET=your_super_secret_key_change_this_in_production

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@management.app

# Frontend
FRONTEND_URL=http://localhost:3000

# Environment
NODE_ENV=development
PORT=3001
SHOW_RESET_LINK=true
```

## Database Setup

```bash
cd backend

# Run migrations
npm run prisma:migrate

# Or just generate the Prisma client
npm run postinstall
```

## Running the Application

### Backend (NestJS)

```bash
cd backend

# Development mode (with watch)
npm run start:dev

# Production mode
npm start

# Debug mode
npm run start:debug
```

### Frontend (Next.js)

```bash
cd frontend

# Development server
npm run dev

# Production build
npm run build
npm start
```

## What Was Installed

### Backend Dependencies

- **NestJS**: `@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`
- **Database**: `@prisma/client`, `@prisma/adapter-pg`, `pg`
- **Authentication**: `passport`, `passport-jwt`, `bcrypt`
- **Validation**: `class-validator`, `class-transformer`
- **Export**: `exceljs`, `pdfkit`
- **Email**: `nodemailer`
- **TypeScript Types**: `@types/node`, `@types/bcrypt`, `@types/express`, etc.

### Frontend Dependencies

- **React 19**
- **Next.js 16**
- **TailwindCSS 4**
- **React Hook Form**
- **React Query**
- **Shadcn UI**
- **Recharts** (for charts)
- **Zod** (for validation)
- **Zustand** (for state management)

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill it
kill -9 <PID>
```

### Prisma Client Generation Failed

```bash
cd backend
rm -rf node_modules/@prisma
npm install
npm run postinstall
```

### Database Connection Error

Ensure your `DATABASE_URL` in `.env` is correct:

```bash
postgresql://username:password@localhost:5432/database_name
```

## Next Steps

1. ✅ Install dependencies
2. ✅ Configure `.env` file
3. ✅ Set up database
4. ✅ Run migrations
5. 🚀 Start developing!
