@echo off
title Hospital Management System - Database Setup
echo ===================================================================
echo Hospital Management System - MongoDB Setup
echo ===================================================================
echo.
echo This project uses MongoDB through Mongoose. You do not need to run a
echo separate "database server" script for application features.
echo.
echo Option 1: Local MongoDB
echo   1. Install MongoDB Community Server 6 or newer.
echo   2. Start the service, or run: mongod --dbpath C:\data\db
echo   3. Copy backend\.env.example to backend\.env.
echo   4. Set:
echo        MONGODB_URI=mongodb://localhost:27017/hospital_management
echo   5. Run: npm run seed
echo   6. Run: npm run dev
echo.
echo Option 2: MongoDB Atlas
echo   1. Create a cluster and database user.
echo   2. Allow your IP address.
echo   3. Copy backend\.env.example to backend\.env.
echo   4. Set:
echo        MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/hospital_management
echo   5. Run: npm run seed
echo   6. Run: npm run dev
echo.
echo The API starts on http://localhost:4000
echo Swagger UI: http://localhost:4000/api/docs
echo Frontend:   http://localhost:5173
echo.
echo Note: "npm run seed" recreates the demo data and is destructive.
echo ===================================================================
pause
