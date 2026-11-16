# 验收记录（0.2.0，2026-11-01）

## 2026-11-16 数值化额度与宿主发现

- 真正原因：桌面主窗口 URL 为 `doubao://doubao-chat/chat/<会话ID>`，旧规则要求路径恰为 `/chat`，宿主发现返回空，气泡显示未连接。现仅在本机监听端口归属豆包时接受 `/chat/<id>`。
- 真实隐藏页读取通过：约 1.3 秒返回标准套餐 已用 1,723/9,000、活动赠送 116/200 与 0/400（合并 116/600）、可用 8,961、赠送 1,684；读取后 target 关闭，前台页面不变。
- `npm test` 35 项通过（新增：数值卡片解析与过期赠额剔除、合并活动条、`/chat/<id>` 目标）。UI 回归 12 项通过，新增“点击角色刷新额度且气泡保持展开”；指针拖动一项记为跳过，原因见下。
- 指针拖动断言在 2026-11-15 改为采样系统光标后无法用 Playwright 合成事件验证：实测系统光标始终停在 (880,786)，窗口不随合成移动。该行为需要原生光标夹具，不计入本轮通过。
- 已部署到本机便携运行目录（6 个文件 SHA-256 一致）并只重启挂件；旧文件与设置备份在 `artifacts/quota-numeric-20261116`。

T01–T08 的功能已实现，T09 Windows 原生跟随已实现。实现内容按后续用户交互要求调整，任务卡中的示例额度字段和前台弹窗流程不作为当前行为。

- 27 项单元与本地 CDP 集成测试通过，包含未知额度、缓存、宿主切换、官方已用/总额解析、10% 彩蛋边界、隐藏 target 参数及成功/失败清理。
- Electron UI 回归通过：豆包普通点击不改表情/光感、台词连续切换且气泡保留、分页、自动收起、形态切换、实际鼠标拖动、缩放、设置重启恢复和无渲染异常。
- 桌面和窗口内左右底角吸附、跨中线翻转、独立保存位置、窗口内持续鼠标拖动通过实机测试。
- 官方豆包 2.32.6 的隐藏页面读取曾实测成功；本轮复测时客户端没有开放 CDP，真实读取三轮复测未通过连接前置条件。该情况显示未知，不弹前台额度页面。

T10 尚有验收未完成：2 小时运行、多屏混合 DPI、全场景性能。已有资源样本不能证明 CPU 持续 <2% 或总内存 <150MB；测试带设置窗口时内存明显高于该目标。预览版发布不表示这些指标已通过。

发布前还运行便携包启动和完整哈希检查。界面截图来自独立测试设置，当前无 CDP 时显示未知，不包含用户会话内容。

前后台层级在之前的独立遮挡窗口测试曾通过，本轮复测因 Windows 未授予测试设置窗口前台焦点而超时；当前源码的该项再次验证未通过，不计入本轮全通过声明。

补充：奶包普通点击保持表情与光感的 UI 检查已通过，10% 彩蛋按独立规则处理。0.2.0 便携 EXE 启动、角色载入、设置打开、142 项文件哈希与 ZIP CRC/SHA256 检查通过。独立性能样本：启动 454ms；三次 CPU 合计约 0.47%、1.70%、1.71%；工作集加总约 322MiB，private bytes 加总约 115MiB（不同内存口径不可混用，不计为 <150MB 达标）。

## 2026-11-12 窗口可见性修复

主进程遵循原生 visible 标志；仅在宿主/挂件前台时显示，检测最小化、隐藏和 DWM cloaked。取消后台插入前景窗口附近与每秒反复置顶，所有定位操作加 SWP_NOOWNERZORDER。独立可控宿主窗口的隐藏、最小化、切换其他应用和返回四项实机 Electron 回归通过；原 28 项自动测试通过。未单独执行物理 Win 键测试。

## 2026-11-12 层级行为更正

按用户确认：切换应用不隐藏挂件。挂件为非置顶普通窗口，紧邻豆包上方，保持其他窗口的相对顺序，豆包隐藏/最小化/cloaked 才隐藏。已通过普通前景窗口与置顶窗口遮挡而不隐藏、紧邻宿主层级、宿主隐藏/最小化、返回恢复的实际窗口测试，28 项自动测试通过。上一节“切应用隐藏”已被本次行为替代。

## 2026-11-12 切回宿主闪烁修复

建立原生 owner 关系，系统在宿主激活时同步处理挂件层级，避免轮询补层级的时间差；退出辅助进程时恢复原 owner。4 轮其他窗口/挂件切换未产生 show/hide 事件，隐藏/最小化/恢复、普通与置顶窗口遮挡、宿主关闭后挂件窗口存活测试通过。28 项自动测试通过。未以高帧率视频测量单帧闪烁；首次 UI 回归出现前景焦点未授予导致等待超时，重跑通过。

## 2026-11-12 拖动跟随优化（本机待用户确认）

- 原生跟随改为 WinEvent 消息唤醒；实际移动期间以 2ms 等待补足事件间隙，仅运动期间申请高精度计时，静止后释放。几何跟随先于较低频率的状态消息，保留非置顶和 owner 行为。
- `node tools/verify-native-follow.cjs` 使用独立宿主/挂件窗口，对修改前后各执行 180 次 8ms 节奏往返移动。本轮大肥豆原生响应中位数 8.683ms → 2.381ms，P95 23.298ms → 7.226ms，结束偏移与单独拖动挂件后的新偏移误差均 0px。此为 Win32 坐标响应，不是桌面合成帧延迟、物理拖动或多屏验收。
- 28 项自动测试通过；独立 Electron 回归通过隐藏、最小化、恢复、普通/置顶窗口遮挡和焦点切换不产生 show/hide。测试宿主改为专用进程名，避免生产挂件误绑定测试窗口；测试命令文件的临时共享冲突允许下次重读。
- 本机当前便携运行目录的 `resources/app/src/native/WindowFollower.cs` 和 `.exe` 已同步，二进制 SHA-256 与源码目录编译产物一致。回退备份在 `artifacts/pre-follow-20261112-074230/installed-native`。本机运行目录为工作修补版，历史 ZIP/校验清单未重发，GitHub 与 Release 等用户验证后再更新。
- 证据：`artifacts/native-follow-check/results.json`、`artifacts/visibility-test/result.json`。仍待用户验证实际快速拖动、高刷新率和跨屏混合 DPI 的观感。

## 2026-11-12 / 0.2.1 发布完成

手动形象记忆与旧设置迁移已完成，30 项自动测试通过；便携 EXE 连续三次启动分别验证豆包、豆奶、豆包，包内 150 个文件校验通过。任务栏联动脚本已纳入便携包并支持 resources/app 源码位置。公开源码提交 459bd9d，GitHub Release v0.2.1 的 ZIP 和 SHA-256 文件上传并验证完成。公开导出仍使用 dist/public-source-0.2.0，目录名不代表其中当前版本。

## 2026-11-12 绑定后丢失左侧停靠修复（本机）

移除原生 Follow 首次绑定强制右下角定位，由主进程统一恢复已保存停靠位置；宿主句柄变化也重算保存布局。隔离 Electron 左侧停靠后切出/重新进入窗口模式的位置回归通过；隐藏、最小化、恢复和遮挡回归及 30 项测试通过。本机运行目录已同步并重启，公开 Release 尚未包含本次修复。

## 2026-11-15 Drag direction fix
- Drag start, move and end now use Electron screen.getCursorScreenPoint() in DIP space, matching BrowserWindow bounds, rather than renderer screen coordinates that can change as a captured window moves under display scaling.
- 31 existing/unit checks passed including the new stale-coordinate regression; one additional isolated Electron integration passed long press, down/up movement and final position persistence (32 total). Integration uses a native cursor fixture and renderer pointer input, not physical mixed-DPI acceptance.
- Updated only src/main/window-manager.js in the currently installed dist/DouBao-Nailoong-Widget-0.2.0-win-x64-20261101-163042/resources/app; other local uncommitted work was not deployed. Restarted widget only. Backup and deployment verification: artifacts/drag-fix-current.json and artifacts/drag-fix-result.json.
## 2026-11-15 Drag-size regression supersedes coordinate-only diagnosis
- Reproduced the reported upward movement with an actual Electron window owned by the current Doubao host at 150% DPI. Reusing getBounds() dimensions in every setBounds() call increased width/height by approximately 1 DIP per frame; bottom confinement then moved the top upward. The earlier cursor-only fix did not cover this failure.
- Window placement now reapplies canonical dimensions from WINDOW_WIDTH/WINDOW_HEIGHT and effectiveScale, avoiding cumulative native size rounding. setPosition alone was tested and still reproduced growth, so it is not the fix.
- npm test: 32 passed. Unit fake now reproduces the native +1 size behavior. Actual host-owned Electron window test: 100 bottom-drag updates retained 341x500 bounds and y=450; mid-client down/up offsets +30,+60,+20,-20 matched the requested direction without size growth. Cursor remains a controlled native fixture, not physical-mouse acceptance; desktop automation could not bind the host window (owner identity mismatch).
- Deployed matching window-manager.js to the active portable install and restarted only the widget. Previous file and settings: artifacts/drag-size-fix-20261115-203323. Evidence artifacts/host-drag-native-result.json and artifacts/drag-size-fix-release.json. Desktop shortcut 大肥豆挂件.lnk points to the same updated install. Existing user settings preserved.