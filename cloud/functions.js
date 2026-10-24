const { Parse } = global;

function trim(v) { return typeof v === 'string' ? v.trim() : v; }

Parse.Cloud.beforeSave('Post', async (request) => {
  const obj = request.object;
  if (obj.isNew()) {
    if (!request.user) throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'login required');
    obj.set('author', request.user);
    obj.set('likesCount', 0);
    obj.set('commentsCount', 0);
    const acl = new Parse.ACL();
    acl.setPublicReadAccess(true);
    acl.setWriteAccess(request.user, true);
    obj.setACL(acl);
  } else {
    // update : interdire changement de author/likesCount/commentsCount (clients uniquement)
    if (request.user) {
      const orig = request.original;
      if (orig && obj.get('author') && orig.get('author') && obj.get('author').id !== orig.get('author').id) {
        throw new Parse.Error(142, 'cannot change author');
      }
      if (orig && obj.get('likesCount') !== orig.get('likesCount')) throw new Parse.Error(142, 'cannot change likesCount');
      if (orig && obj.get('commentsCount') !== orig.get('commentsCount')) throw new Parse.Error(142, 'cannot change commentsCount');
    }
  }
  const title = trim(obj.get('title'));
  const body = trim(obj.get('body'));
  if (typeof title !== 'string' || title.length < 3 || title.length > 120) throw new Parse.Error(142, 'invalid title');
  if (typeof body !== 'string' || body.length < 1 || body.length > 5000) throw new Parse.Error(142, 'invalid body');
  obj.set('title', title);
  obj.set('body', body);
});

Parse.Cloud.beforeSave('Comment', async (request) => {
  const obj = request.object;
  const text = trim(obj.get('text'));
  if (typeof text !== 'string' || text.length < 1 || text.length > 500) throw new Parse.Error(142, 'invalid text');
  obj.set('text', text);
  const post = obj.get('post');
  if (!post) throw new Parse.Error(101, 'post not found');
  const exists = await new Parse.Query('Post').get(post.id || post.objectId, { useMasterKey: true }).catch(() => null);
  if (!exists) throw new Parse.Error(101, 'post not found');
  if (obj.isNew()) {
    if (!request.user) throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'login required');
    obj.set('author', request.user);
    const acl = new Parse.ACL();
    acl.setPublicReadAccess(true);
    acl.setWriteAccess(request.user, true);
    obj.setACL(acl);
  }
});

Parse.Cloud.afterSave('Comment', async (request) => {
  if (!request.original) {
    const post = request.object.get('post');
    const p = await new Parse.Query('Post').get(post.id || post.objectId, { useMasterKey: true });
    await p.increment('commentsCount');
    await p.save(null, { useMasterKey: true });
  }
});

Parse.Cloud.afterDelete('Comment', async (request) => {
  const post = request.object.get('post');
  const p = await new Parse.Query('Post').get(post.id || post.objectId, { useMasterKey: true }).catch(() => null);
  if (p) { await p.increment('commentsCount', -1); await p.save(null, { useMasterKey: true }); }
});

Parse.Cloud.afterDelete('Post', async (request) => {
  const post = request.object;
  const cq = new Parse.Query('Comment'); cq.equalTo('post', post);
  const lq = new Parse.Query('Like'); lq.equalTo('post', post);
  const [comments, likes] = await Promise.all([
    cq.find({ useMasterKey: true }),
    lq.find({ useMasterKey: true }),
  ]);
  await Parse.Object.destroyAll(comments, { useMasterKey: true });
  await Parse.Object.destroyAll(likes, { useMasterKey: true });
});

Parse.Cloud.define('toggleLike', async (request) => {
  if (!request.user) throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'login required');
  const { postId } = request.params || {};
  if (!postId) throw new Parse.Error(142, 'postId required');
  const post = await new Parse.Query('Post').get(postId, { useMasterKey: true })
    .catch(() => { throw new Parse.Error(101, 'post not found'); });
  const lq = new Parse.Query('Like');
  lq.equalTo('post', post);
  lq.equalTo('user', request.user);
  const existing = await lq.first({ useMasterKey: true });
  let liked;
  if (existing) {
    await existing.destroy({ useMasterKey: true });
    await post.increment('likesCount', -1);
    liked = false;
  } else {
    try {
      const like = new Parse.Object('Like');
      like.set('post', post);
      like.set('user', request.user);
      const acl = new Parse.ACL(); acl.setPublicReadAccess(true);
      like.setACL(acl);
      await like.save(null, { useMasterKey: true });
      await post.increment('likesCount');
      liked = true;
    } catch (e) {
      // duplicate key (parallel) → treat as already liked
      const ex = await lq.first({ useMasterKey: true });
      if (ex) { await ex.destroy({ useMasterKey: true }); await post.increment('likesCount', -1); liked = false; }
      else throw e;
    }
  }
  await post.save(null, { useMasterKey: true });
  return { liked, likesCount: post.get('likesCount') };
}, { requireUser: true });

Parse.Cloud.define('userStats', async (request) => {
  const { userId } = request.params || {};
  const user = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true })
    .catch(() => { throw new Parse.Error(101, 'user not found'); });
  const posts = await new Parse.Query('Post').equalTo('author', user).count({ useMasterKey: true });
  const comments = await new Parse.Query('Comment').equalTo('author', user).count({ useMasterKey: true });
  const userPosts = await new Parse.Query('Post').equalTo('author', user).find({ useMasterKey: true });
  const likesReceived = userPosts.reduce((s, p) => s + (p.get('likesCount') || 0), 0);
  return { posts, comments, likesReceived };
});
