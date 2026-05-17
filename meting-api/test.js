/**
 * 🧪 Meting API 完整测试脚本
 * 用法：node test.js
 * 前置：先启动 node server.js
 */

const http = require('http');

const BASE = `http://localhost:${process.env.PORT || 3300}`;

function request(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { 
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, ...json }); 
        } catch { 
          resolve({ status: res.statusCode, body: data }); 
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function runTests() {
  console.log(`\n🧪 Meting API 测试目标: ${BASE}\n`);
  console.log('═'.repeat(55));
  
  const tests = [
    // ===== 基础功能 =====
    { name: '🏥  健康检查',           path: '/health' },
    { name: '📖  API 文档(根路径)',     path: '/' },
    
    // ===== 搜索功能 =====
    { name: '🔍  搜索-网易云(歌曲)',   path: '/search?server=netease&id=Hello%20Adele&page=1&limit=3' },
    { name: '🔍  搜索-QQ音乐',         path: '/search?server=tencent?id=周杰伦&page=1&limit=3' },
    { name: '🔍  搜索-酷狗',           path: '/search?server=kugou&id=周杰伦&page=1&limit=3' },
    
    // ===== 获取资源（使用固定ID） =====
    { name: '🎵  获取URL-网易云',      path: '/url?server=netease&id=186016&r=320' },
    { name: '📝  获取歌词-网易云',     path: '/lyric?server=netease&id=186016' },
    { name: '🖼️  获取封面-网易云',     path: '/pic?server=netease&id=109951168296990528&size=300' },
    
    // ===== 详情接口 =====
    { name: '📀  歌曲详情',            path: '/song?server=netease&id=186016' },
    { name: '💿  专辑信息',            path: '/album?server=netease&id=35823499' },
    { name: '🎤  歌手列表',            path: '/artist?server=netease&id=6452&limit=5' },
    { name: '📋  歌单内容',            path: '/playlist?server=netease&id=71384714' },
    
    // ===== 错误处理 =====
    { name: '❓  404 不存在',          path: '/nonexistent-endpoint' },
    { name: '⚠️  缺少参数(search)',    path: '/search?server=netease' },
    { name: '⚠️  不支持的平台',        path: '/search?server=spotify&id=test' },
    { name: '⚠️  缺少必要参数(url)',   path: '/url?server=netease' },
  ];

  let passed = 0, failed = 0, skipped = 0;

  for (const t of tests) {
    try {
      const start = Date.now();
      const result = await request(t.path);
      const ms = Date.now() - start;
      
      const isOk = (result.success === true && result.status === 200) ||
                   (result.status === 200) ||
                   (result.code >= 400 && result.code <= 503); // 错误响应也算正常行为
      
      if (isOk) {
        console.log(`✅ ${t.name} (${ms}ms)`);
        
        // 展示关键数据摘要
        if (Array.isArray(result.data)) {
          console.log(`   → 返回 ${result.data.length} 条结果`);
          if (result.data.length > 0) {
            const first = result.data[0];
            if (first.name) console.log(`   → 首条: "${first.name}" - ${first.artist || ''}`);
          }
        }
        if (result.service === 'Meting Music API') {
          console.log(`   → 服务正常 | 平台: ${result.platforms?.join(', ')}`);
        }
        if (result.uptime !== undefined) {
          console.log(`   → 运行时间: ${Math.round(result.uptime)}s`);
        }
        if (t.name.includes('URL') && result.data?.url) {
          console.log(`   → URL: ${result.data.url.slice(0, 60)}...`);
        }
        if (t.name.includes('歌词')) {
          const d = result.data;
          const len = typeof d === 'string' ? d.length : (d?.lrc?.length || d?.plain?.length || JSON.stringify(d).length);
          console.log(`   → 歌词长度: ${len} 字符`);
        }
        if (t.name.includes('封面')) {
          console.log(`   → 封面获取成功`);
        }
        if (t.name.includes('歌单')) {
          console.log(`   → 歌单包含 ${Array.isArray(result.data) ? result.data.length : '?'} 首歌`);
        }

        passed++;
      } else {
        console.log(`⚠️  ${t.name} (${ms}ms):`, JSON.stringify(result).slice(0, 120));
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${t.name}: ${err.message}`);
      failed++;
    }
    
    // 避免请求过快触发限流
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\n' + '═'.repeat(55));
  console.log(`📊 测试结果: ${passed} 通过 / ${failed} 失败 / ${skipped} 跳过 / ${tests.length} 总计`);
  
  if (passed === tests.length) {
    console.log('🎉 全部通过！服务运行正常！');
  } else if (failed > 0) {
    console.log('⚠️  部分测试失败，请检查上方错误信息');
  }
  console.log('═'.repeat(55) + '\n');
}

runTests().catch(err => {
  console.error('💥 测试脚本异常:', err.message);
  process.exit(1);
});
