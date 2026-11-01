# 角色素材

八张文件位于 assets/characters/doubao 和 assets/characters/nailoong。idle 字节保持用户两张原图一致，其余由内置 image_gen 工具生成，无 CLI/API 回退。

共同提示词：Create a single transparent PNG desktop pet expression asset based exactly on reference. Preserve character identity, brown bob hair, chibi head and shoulders composition, original colors and clothing/body, same orientation and head tilt, clean polished 2D illustration. Full silhouette within frame with transparent padding, no text, no background, no extra characters.

- doubao/thinking: Thoughtful, looking slightly upward, small thoughtful mouth, preserve red scarf.
- doubao/happy: Happy smiling eyes, tiny cheerful smile, preserve red scarf.
- doubao/warning: Worried eyebrows, nervous small mouth, preserve red scarf.
- nailoong/proud: Proud confident eyebrows and small smug smile.
- nailoong/angry: Cute angry furrowed eyebrows, pout.
- nailoong/crying: Sad eyes with two small tears, downturned mouth.

均为 RGBA PNG，1337×1177，含真实透明通道。artifacts/characters-review.png 为本地 QA 拼图，不用作角色资源。当前保留较高分辨率，未达到任务卡每张 <100KB 的推荐体积。

## 应用图标

assets/ui/icon.png 与 icon.ico：基于豆包原图生成，奶油白圆角底、围巾红边框、深棕短发，透明外角，无文字或光晕。ICO 仅作多尺寸格式转换。提示词方向：simple polished Windows app icon, preserve chibi dark bob hair, cream face and red scarf, rounded ivory square, muted red rim, transparent corners, no words, no glow.
