const test = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { ParseServer } = require('parse-server');
const Parse = require('parse/node');
const path = require('path');
const http = require('http');
const express = require('express');

let mongo, server, httpServer;

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  const { schemaDefinitions } = require('../cloud/schema');
  server = new ParseServer({
    databaseURI: mongo.getUri(),
    cloud: path.join(__dirname, '..', 'cloud', 'main.js'),
    appId: 'blog-app',
    masterKey: 'masterkey',
    serverURL: 'http://localhost:1339/parse',
    allowClientClassCreation: false,
    enforcePrivateUsers: true,
    schema: { definitions: schemaDefinitions, lockSchemas: true, strict: true, recreateModifiedFields: false, deleteExtraFields: false },
  });
  await server.start();
  const app = express();
  app.use(express.json());
  app.use('/parse', server.app);
  httpServer = http.createServer(app);
  await new Promise((r) => httpServer.listen(1339, r));
  Parse.initialize('blog-app', null, 'masterkey');
  Parse.serverURL = 'http://localhost:1339/parse';
  Parse.User.enableUnsafeCurrentUser();
});

test.after(async () => {
  await new Promise((r) => httpServer.close(r));
});

async function ensureUser(u) {
  try {
    const user = new Parse.User();
    user.set('username', u);
    user.set('password', 'Password123!');
    user.set('email', u + '@x.com');
    await user.signUp();
    return user;
  } catch (e) {
    return await Parse.User.logIn(u, 'Password123!');
  }
}
async function loginAs(u) {
  await ensureUser(u);
  Parse.User.logOut();
  await Parse.User.logIn(u, 'Password123!');
  return Parse.User.current();
}

test('health', async () => {
  const r = await fetch('http://localhost:1339/parse/health');
  const j = await r.json();
  assert.deepStrictEqual(j, { status: 'ok' });
});

test('R2/R3 post validation + author forced', async () => {
  await loginAs('alice');
  const st = Parse.User.current().getSessionToken();
  const Post = Parse.Object.extend('Post');
  const p = new Post();
  p.set('title', 'hi there');
  p.set('body', 'body');
  p.set('likesCount', 999);
  const saved = await p.save(null, { sessionToken: st });
  assert.strictEqual(saved.get('likesCount'), 0);
  assert.strictEqual(saved.get('author').id, Parse.User.current().id);
  const p2 = new Post();
  p2.set('title', 'ab');
  p2.set('body', 'body');
  await assert.rejects(p2.save(null, { sessionToken: st }), /142|Validation/);
  Parse.User.logOut();
});

test('R4 comment validation + missing post', async () => {
  await loginAs('bob');
  const st = Parse.User.current().getSessionToken();
  const Comment = Parse.Object.extend('Comment');
  const c = new Comment();
  c.set('text', 'hi');
  c.set('post', new Parse.Object('Post', { id: '000000000000000000000000' }));
  await assert.rejects(c.save(null, { sessionToken: st }), /101|Object not found/);
  Parse.User.logOut();
});

test('R5 commentsCount', async () => {
  await loginAs('alice');
  const st = Parse.User.current().getSessionToken();
  const Post = Parse.Object.extend('Post');
  const p = new Post(); p.set('title','title ok'); p.set('body','body'); const saved = await p.save(null, { sessionToken: st });
  const Comment = Parse.Object.extend('Comment');
  const c = new Comment(); c.set('text','c'); c.set('post', saved);
  await c.save(null, { sessionToken: st });
  const refreshed = await new Parse.Query('Post').get(saved.id, { sessionToken: st });
  assert.strictEqual(refreshed.get('commentsCount'), 1);
  Parse.User.logOut();
});

test('R7 toggleLike', async () => {
  await loginAs('alice');
  const st = Parse.User.current().getSessionToken();
  const Post = Parse.Object.extend('Post');
  const p = new Post(); p.set('title','likepost'); p.set('body','b'); const saved = await p.save(null, { sessionToken: st });
  const res = await Parse.Cloud.run('toggleLike', { postId: saved.id }, { sessionToken: st });
  assert.strictEqual(res.liked, true);
  const res2 = await Parse.Cloud.run('toggleLike', { postId: saved.id }, { sessionToken: st });
  assert.strictEqual(res2.liked, false);
  Parse.User.logOut();
});

test('R1 client class creation forbidden', async () => {
  await loginAs('alice');
  const st = Parse.User.current().getSessionToken();
  const X = Parse.Object.extend('Nope');
  const o = new X(); o.set('a',1);
  await assert.rejects(o.save(null, { sessionToken: st }), /101|119|forbidden/i);
  Parse.User.logOut();
});
