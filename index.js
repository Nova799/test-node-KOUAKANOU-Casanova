require('dotenv').config();
const express = require('express');
const { ParseServer } = require('parse-server');
const http = require('http');
const path = require('path');
const { schemaDefinitions } = require('./cloud/schema');

const app = express();
app.use(express.json());

const server = new ParseServer({
  databaseURI: process.env.DATABASE_URI || 'mongodb://localhost:27017/blog',
  cloud: path.join(__dirname, 'cloud', 'main.js'),
  appId: process.env.APP_ID || 'blog-app',
  masterKey: process.env.PARSE_MASTER_KEY,
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
  allowClientClassCreation: false,
  enforcePrivateUsers: true,
  schema: {
    definitions: schemaDefinitions,
    lockSchemas: true,
    strict: true,
    recreateModifiedFields: false,
    deleteExtraFields: false,
  },
});

(async () => {
  await server.start();
  app.use('/parse', server.app);
  app.get('/', (_req, res) => res.send('blog-api reference'));
  const port = process.env.PORT || 1337;
  const httpServer = http.createServer(app);
  httpServer.listen(port, () => console.log('listening on', port));
  await ParseServer.createLiveQueryServer(httpServer);
})();
