import { MongoClient } from 'mongodb';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI 환경변수를 설정해 주세요.\n' +
      '  - 로컬: .env.local\n' +
      '  - Vercel: Settings → Environment Variables'
    );
  }
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }
  return new MongoClient(uri).connect();
}

// thenable 객체 — import 시점에는 연결하지 않고, .then()/.catch()가 호출될 때만 연결
const clientPromise: Promise<MongoClient> = {
  then: (...args) => getMongoClient().then(...args),
  catch: (...args) => getMongoClient().catch(...args),
  finally: (...args) => getMongoClient().finally(...args),
  [Symbol.toStringTag]: 'Promise',
} as Promise<MongoClient>;

export default clientPromise;
