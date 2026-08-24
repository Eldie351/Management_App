#!/bin/bash

# Installation script for Management_App dependencies

echo "🚀 Starting dependency installation for Management_App..."

# Backend setup
echo "📦 Installing backend dependencies..."
cd backend
npm install

if [ $? -eq 0 ]; then
  echo "✅ Backend dependencies installed successfully"
  echo "🔧 Running Prisma setup..."
  npm run postinstall
else
  echo "❌ Backend installation failed"
  exit 1
fi

cd ..

# Frontend setup
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

if [ $? -eq 0 ]; then
  echo "✅ Frontend dependencies installed successfully"
else
  echo "❌ Frontend installation failed"
  exit 1
fi

cd ..

echo ""
echo "🎉 All dependencies installed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Configure your .env file in the backend directory"
echo "   2. Set up your database"
echo "   3. Run database migrations: cd backend && npm run prisma:migrate"
echo "   4. Start the backend: npm start (or npm run start:dev)"
echo "   5. Start the frontend: cd frontend && npm run dev"
echo ""
