import mongoose from "mongoose";

const opts = {
  serverSelectionTimeoutMS: 10000,
  maxPoolSize: 10,
  family: 4,
};

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, opts)
      .then((m) => {
        console.log(`[MongoDB] connected database="${m.connection.name}"`);
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        console.error("MongoDB connection failed:", err.message);
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
