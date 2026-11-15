const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

async function connectTestDatabase() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'hms_test' });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

async function clearTestDatabase() {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

async function disconnectTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

module.exports = { connectTestDatabase, clearTestDatabase, disconnectTestDatabase };
