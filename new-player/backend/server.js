const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const NeteaseCloudMusicApi = require('NeteaseCloudMusicApi');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 健康检查
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'IanMusic Backend API', version: '1.0.0' });
});

// 搜索歌曲
app.get('/api/search', async (req, res) => {
  try {
    const { keywords, limit = 30, offset = 0, type = 1 } = req.query;
    if (!keywords) {
      return res.status(400).json({ error: 'keywords is required' });
    }

    const result = await NeteaseCloudMusicApi.cloudsearch({
      keywords,
      limit,
      offset,
      type // 1: 单曲, 10: 专辑, 100: 歌手, 1000: 歌单, 1002: 用户
    });

    res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// 获取歌词
app.get('/api/lyric', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'song id is required' });
    }

    const result = await NeteaseCloudMusicApi.lyric({ id });
    res.json(result);
  } catch (error) {
    console.error('Lyric error:', error);
    res.status(500).json({ error: 'Failed to get lyrics', details: error.message });
  }
});

// 获取歌曲详情
app.get('/api/song/detail', async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'song ids is required' });
    }

    const result = await NeteaseCloudMusicApi.song_detail({ ids });
    res.json(result);
  } catch (error) {
    console.error('Song detail error:', error);
    res.status(500).json({ error: 'Failed to get song details', details: error.message });
  }
});

// 获取歌曲URL
app.get('/api/song/url', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'song id is required' });
    }

    const result = await NeteaseCloudMusicApi.song_url({ id });
    res.json(result);
  } catch (error) {
    console.error('Song URL error:', error);
    res.status(500).json({ error: 'Failed to get song URL', details: error.message });
  }
});

// 获取歌单详情
app.get('/api/playlist/detail', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'playlist id is required' });
    }

    const result = await NeteaseCloudMusicApi.playlist_detail({ id });
    res.json(result);
  } catch (error) {
    console.error('Playlist detail error:', error);
    res.status(500).json({ error: 'Failed to get playlist details', details: error.message });
  }
});

// 用户认证（模拟）
const users = [
  { id: 1, username: process.env.DEMO_USER || 'demo', password: process.env.DEMO_PASS || 'demo', name: 'Demo', avatar: '' }
];

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    const token = `fake-jwt-token-${Date.now()}`;
    res.json({ 
      success: true, 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        name: user.name, 
        avatar: user.avatar 
      } 
    });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// 评论系统（模拟）
const comments = [
  { id: 1, songId: '123', userId: 1, username: 'ian', content: '这首歌真好听！', timestamp: '2026-04-13T10:00:00Z', likes: 5 },
  { id: 2, songId: '123', userId: 2, username: 'guest', content: '经典永流传', timestamp: '2026-04-13T11:30:00Z', likes: 3 }
];

// 获取歌曲评论
app.get('/api/comments', (req, res) => {
  const { songId } = req.query;
  if (!songId) {
    return res.status(400).json({ error: 'songId is required' });
  }
  
  const songComments = comments.filter(c => c.songId === songId);
  res.json({ comments: songComments });
});

// 发布评论
app.post('/api/comments', (req, res) => {
  const { songId, userId, username, content } = req.body;
  if (!songId || !content) {
    return res.status(400).json({ error: 'songId and content are required' });
  }
  
  const newComment = {
    id: comments.length + 1,
    songId,
    userId: userId || 0,
    username: username || '匿名用户',
    content,
    timestamp: new Date().toISOString(),
    likes: 0
  };
  
  comments.push(newComment);
  res.json({ success: true, comment: newComment });
});

// 测试端点
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`IanMusic Backend API running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}`);
});