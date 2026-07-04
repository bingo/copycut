# 测试素材

人工/自动化测试编辑器用的固定素材,避免每次测试临时生成。

| 文件 | 说明 |
| --- | --- |
| `test-image.png` | 720×1280 纯色图片(5.4KB),图片片段默认 3s |
| `test-video-5s.mp4` | 720×1280 30fps 5s,testsrc 花纹自带滚动时间戳,含 440Hz 音轨(113KB),适合验证 seek / 分割 / 修剪 |

## 用法

- **手工测试**:直接从本目录拖进编辑器素材面板。
- **浏览器自动化**:文件在 `public/` 下,dev server 直接可访问;在页面里 fetch 后构造 File 派发给文件输入即可(比 file_upload 工具更可靠):

```js
const blob = await fetch('/test-assets/test-video-5s.mp4').then((r) => r.blob());
const file = new File([blob], 'test-video-5s.mp4', { type: 'video/mp4' });
const dt = new DataTransfer();
dt.items.add(file);
const input = document.querySelector('input[type=file]');
input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true }));
```

## 重新生成

```sh
ffmpeg -y -f lavfi -i "testsrc=size=720x1280:rate=30:duration=5" \
  -f lavfi -i "sine=frequency=440:duration=5" \
  -c:v libx264 -pix_fmt yuv420p -profile:v baseline -crf 28 \
  -c:a aac -b:a 64k -movflags +faststart test-video-5s.mp4
```
