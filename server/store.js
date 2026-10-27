// MongoDB-backed store. One collection per entity.
// Drop-in replacement for the old JSON-file store.

import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "formbuilder";

const client = new MongoClient(MONGO_URI);
const dbReady = client.connect().then(() => client.db(DB_NAME));

export function makeStore(name) {
  const collName = name.replace(/\.json$/, "");
  const col = dbReady.then((db) => db.collection(collName));

  return {
    async all() {
      return (await col).find().toArray();
    },
    async find(id) {
      return (await col).findOne({ id });
    },
    async insert(row) {
      await (await col).insertOne({ ...row });
      return row;
    },
    async update(id, patch) {
      const c = await col;
      const result = await c.findOneAndUpdate(
        { id },
        { $set: patch },
        { returnDocument: "after" },
      );
      if (!result) return null;
      const { _id, ...doc } = result;
      return doc;
    },
    async updateIf(id, version, patch) {
      const c = await col;
      const result = await c.findOneAndUpdate(
        { id, version },
        { $set: patch },
        { returnDocument: "after" },
      );
      if (!result) return null;
      const { _id, ...doc } = result;
      return doc;
    },
    async filter(fn) {
      const rows = await (await col).find().toArray();
      return rows.filter(fn);
    },
    async countByField(field) {
      const pipeline = [
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      ];
      const results = await (await col).aggregate(pipeline).toArray();
      return Object.fromEntries(results.map((r) => [r._id, r.count]));
    },
    async ensureIndex(spec, options) {
      await (await col).createIndex(spec, options);
    },
  };
}

export async function ensureIndexes(stores) {
  const { forms, responses, submissions } = stores;
  await forms.ensureIndex({ id: 1 }, { unique: true });
  await responses.ensureIndex({ id: 1 }, { unique: true });
  await responses.ensureIndex({ submissionId: 1 }, { unique: true, sparse: true });
  await responses.ensureIndex({ formId: 1 });
  await submissions.ensureIndex({ id: 1 }, { unique: true });
}

export { dbReady };
