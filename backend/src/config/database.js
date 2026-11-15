const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

async function connectDatabase(uri = env.mongoUri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: true,
  });
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[db] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  }
  return mongoose.connection;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDatabase, disconnectDatabase };
