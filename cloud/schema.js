const schemaDefinitions = [
  {
    className: 'Post',
    fields: {
      title: { type: 'String' },
      body: { type: 'String' },
      author: { type: 'Pointer', targetClass: '_User' },
      likesCount: { type: 'Number', defaultValue: 0 },
      commentsCount: { type: 'Number', defaultValue: 0 },
    },
    classLevelPermissions: {
      find: { '*': true },
      get: { '*': true },
      create: { requiresAuthentication: true },
      update: { requiresAuthentication: true },
      delete: { requiresAuthentication: true },
      count: { '*': true },
    },
  },
  {
    className: 'Comment',
    fields: {
      post: { type: 'Pointer', targetClass: 'Post' },
      author: { type: 'Pointer', targetClass: '_User' },
      text: { type: 'String' },
    },
    classLevelPermissions: {
      find: { '*': true },
      get: { '*': true },
      create: { requiresAuthentication: true },
      update: { requiresAuthentication: true },
      delete: { requiresAuthentication: true },
      count: { '*': true },
    },
  },
  {
    className: 'Like',
    fields: {
      post: { type: 'Pointer', targetClass: 'Post' },
      user: { type: 'Pointer', targetClass: '_User' },
    },
    classLevelPermissions: {
      find: { '*': true },
      get: { '*': true },
      create: {},
      update: {},
      delete: {},
      count: { '*': true },
    },
    indexes: {
      post_user: { post: 1, user: 1 },
    },
  },
];

module.exports = { schemaDefinitions };
