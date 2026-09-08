# 全项目场景审计：目标与批次

> 最新进度（2026-09-09）：old-1与old-2共100角色、659条非R18标签场景已逐条核对内部语义，485条有问题或查证线索；两批414条R18仍为元数据初筛。正史、画面和完整分级验收尚未完成。源修复检查点已在独立分支提交并推送。机器可接续进度见 [progress.json](evidence/all-scene-audit/progress.json)。

用户要求扩大为全项目审计，每批约 50 个角色。已建立持续目标，约尔五条先行验证不再作为完整大批次交付。以下为 2026-09-08 本次源分片快照，不代表全部人工审计完成。

## 范围与批次

覆盖 158 个热门角色的 1681 条蓝图，以及宁宁、夏目、双人组的 302 条独立场景，共 1983 条。100 条定稿场景只读核对保护基线。新增49角色会话所负责角色单列只读审计，其更新在复验时按内容哈希重新对账。

| 批次 | 角色数 | 全部场景 | 非 R18 场景 | 当前阶段 |
| --- | ---: | ---: | ---: | --- |
| old-1 | 50 | 521 | 314 | 非R18内部语义314/314完成；正史、画面及R18深入审核待完成 |
| old-2 | 50 | 552 | 345 | 非R18内部语义345/345完成；设定、画面、R18深入审核待完成 |
| old-3 | 9 | 99 | 63 | 已建清单、完成相同初筛 |
| new49-readonly | 49 | 509 | 313 | 只读初筛，待新批次交付证据对账 |
| studio-1～7 | 宁宁/夏目/双人组 | 302 | 286 | 每组50条，末组2条；初筛完成 |

具体角色及条目归属以[批次清单](evidence/all-scene-audit/summary.json)和[逐条台账](evidence/all-scene-audit/inventory.json)为准。角色批次覆盖该角色全部场景，不是每个角色只抽一条。

## 完成定义

逐条核对角色与作品设定、中文叙事/动作/英文散文/标签一致性、服装状态、镜头和尺寸、灯光与采样参数、分级及定稿字段、真实编译结果和图片证据。结构检查、语义审核、视觉验收分别记录；自动疑点不等于确认缺陷，编译通过不等于出图通过，历史样张存在不等于匹配当前提示词。

所有条目纳入覆盖统计。662 条 R18 条目当前只做元数据、绑定、分级和保护字段审计，不执行显式内容生成或扩写。1321 条非 R18 条目已使用现有编译流程检查：热门双引擎，独立场景目前为 Anima；独立场景 Krea 路径仍待核查。

## 当前发现

- 18 条花嫁服装绑定疑点已经逐条查看中文、英文与服装源，确认其中15条存在叙事与服装冲突；另外3条是可以兼容的形态变体，未误报为必改。[服装专项人工核对](evidence/all-scene-audit/outfit-semantic-review.json)。这只是服装维度，不计作18条完整审计完成。
- 优先问题：希耶尔全年龄白婚纱场景绑定透杯蕾丝内衣；贞德、斯卡哈、伊什塔尔、蕾娜等花嫁绑定战斗服或军装；2B、黑呆、诗羽白婚纱绑定黑礼裙。需同步维护服装与蓝图后真实出图，不靠添加婚纱标签覆盖冲突。
- 34 条夜景被推导为夕阳或日间窗光，是待逐条确认的编译疑点。
- 250 条热门散文短于200字符；266条独立场景没有显式尺寸。两者均为复核线索，不机械判错或补模板。
- 本次检查的 `2026-09-02_v27-miaomiao/manifest.json` 中，1666条没有对应可用图。该数仅是这一份样张清单的缺口，不能解释成全项目没有图片；尚需检索其他历史版本与候选目录。

## 本次验证与边界

`validate-scenes.js`：302场景通过。`optimize-scenes.js --check`：302场景、issues=0、5条可选格式建议；未写源数据。全量快照未出现缺失角色/服装ID、非 R18 编译失败或定稿字段漂移。输出保留[非 R18 编译证据](evidence/all-scene-audit/sfw-compiled-plans.json)及逐文件SHA256，执行期间检查源未变化。

本轮新增审计资料；未修改角色源、聚合产物、活跃样张清单，也未执行Git写操作。上轮共享工作区构建问题不能算成本轮数据审计失败或通过；本轮不宣称全量质量门禁完成。

## 接续工作

1. 以 old-1 的50角色/521条为第一大批。逐角色核对全部条目，优先处理已经确认的服装冲突及错误光照；非 R18 场景再做身份、动作、文本一致性和图像审核。
2. 对账全部样张版本和候选目录，记录源提示词/图片哈希以及是否真正看过原图；未看原图一律 pending。
3. 修复限于已确认且不被其他会话占用的条目；每条改动过完整性、编译和真实渲染，定稿条目遵守先出图再捕获基线。
4. 每批给出完整覆盖分母、确认问题、排除误报、修复数与未验收数；保持目标 active，全部覆盖完成前不标记完成。

本次一次性清单工具在被忽略的 `scripts/archive/all-scene-audit/`，未新增维护入口。后续若提升为常驻工具，须登记工作流并添加针对误报与覆盖完整性的回归验证。

## 第二轮推进：扩展样张对账与第一大批逐条审查

样张已从单一清单扩展为22份历史发布与候选清单；覆盖当前1983条源记录，其中1373条找到了图片文件，610条未在这些清单找到。313条有与当时当前MiaoMiao实际生成器的提示词、负向和所列参数一致的候选；文件存在或参数匹配仍不代表已看原图。第一大批521条里442条有历史图片、当时没有完全匹配的当前候选。此后本轮新生成的8条另见下方最终审核，不混入较早快照。[图片对账摘要](evidence/all-scene-audit/image-summary.json)、[逐图候选索引](evidence/all-scene-audit/image-inventory.json)。

已经逐条读取第一批前20角色的129条非R18场景，核对中文、action、英文、标签、服装、镜头、光照、尺寸；记录99条问题或设定查证线索。证据分为[前10人](evidence/all-scene-audit/old1-first10-semantic-review.json)、[黑贞/樱/摩根](evidence/all-scene-audit/old1-next3-semantic-review.json)、[玛修/卡莲](evidence/all-scene-audit/old1-next2-semantic-review.json)、[黑呆/贞德/斯卡哈/伊什塔尔/艾蕾](evidence/all-scene-audit/old1-next5-semantic-review.json)。其中3条阿尔托莉雅已由后述修复替代，审计基线哈希保留以追溯。

新发现包括：雷电将军海滨正文仍配暴雨夜景参数；芙莉莲荒原行走/花海站立、紫眼/金绿眼互相冲突；玛修白连体泳装正文/白比基尼英文；黑呆黑短裙场景绑内衣；卡莲身份琥珀眼却多数场景紫眼；多条two-shot叙事被统一solo守卫压制。斯卡哈身份散文直接夹带紫色战斗衣，真实编译时会混入旅装和婚纱。灯光推导甚至会把作品名Fate/stay night中的night判作月光，或把金色饰品判成夕阳；公共推导代码本轮尚未修改，避免未审全量的广泛变更。

正史来源开始单独登记：[官方来源记录](evidence/all-scene-audit/canonical-sources.json)。[Saber官方页](https://emiya-gohan.com/character/?chara=saber)仅支持其卫宫宅生活背景，不据文字页宣称颜色核验完成；[菲伦官方页](https://frieren-anime.jp/character/chara_group1/1-5/)提到通过一级考试，因此“希望成为三级”的旧蓝图必须确认时间线，而不能机械改写。

## 本轮已修复与复验

阿尔托莉雅汉堡、洗衣房、公园三条重写：统一现有蓝开衫白衬衣，消除黑西装/风衣、午后/午夜、散步/坐姿冲突；公园明确夕照，修复作品名误推月光。约尔上轮五条补齐老角色门禁要求的四个环境光影标签；红茶改为厨房桌边穿居家围裙倒茶，恢复围裙形态的场景覆盖。

初次全量门禁确实指出本会话遗漏的服装覆盖和光影词条，已修复，未修改测试标准。最终 [8条交付](evidence/all-scene-audit/owned-repairs-final-delivery.json)完整性8/8、词条保留47.4%、散文相似度0.08；[Anima编译](evidence/all-scene-audit/owned-repairs-final-anima-plans.json)与[Krea编译](evidence/all-scene-audit/owned-repairs-final-krea-plans.json)均保留，Krea本轮只编译未出图。

8条按最终提示词重新用MiaoMiao v1.2出图。约尔办公首次最终候选变成举起文件夹，第二次重出才恢复桌面整理纸张，拒绝的候选未计通过。已查看全部采用原图，核对SHA256、实际正负提示词及采样参数，记录可见次要偏差。[最终逐图审核](evidence/all-scene-audit/owned-repairs-final-visual-review.json)，原图在 `E:/code/2/lora/AI/Reviews/ShowcaseRefresh/2026-09-08-owned-repairs-final/`。

最终 `gate:full` 本次通过，包含check、前端、418个unit用例、25组接口契约及构建预算，耗时约2分2秒。[本次完整日志](evidence/all-scene-audit/owned-repairs-gate-full.log)。尚未做浏览器双主题检查、桌面部署、样张发布或Git写操作；源分片/聚合已经更新，候选图尚未替换活跃样张。这些8条也不等于全部角色正史审核完成。

## 第三轮推进：完成第一大批非R18内部语义审查

剩余30角色185条均已逐条核对，未用自动标签检测冒充阅读。与前20人合计50角色、314条非R18记录无缺漏、无重复；241条记录内部冲突或正史查证线索，其余73条未发现重大内部冲突，仍不能据此算画面通过。[整批摘要与修复队列](evidence/all-scene-audit/old1-semantic-summary.json)。

详细证据：[21～26](evidence/all-scene-audit/old1-characters21-26-semantic-review.json)、[27～32](evidence/all-scene-audit/old1-characters27-32-semantic-review.json)、[33～36](evidence/all-scene-audit/old1-characters33-36-semantic-review.json)、[37～42](evidence/all-scene-audit/old1-characters37-42-semantic-review.json)、[43～50](evidence/all-scene-audit/old1-characters43-50-semantic-review.json)。发现幼年绿发/成年白发形态串入、学生宿舍睡袍绑内衣、方舟多条服装句截断、身体模板替代工作动作，以及森蚺蛇族/鳄族描述混杂等问题。

另外使用实际候选生成器检查全项目1035条非R18蓝图的正负向词条，找到13条字面冲突线索、2条白天字段推成月光的记录。[编译交叉检查](evidence/all-scene-audit/compiled-collisions.json)。字面命中不等于模型意义相同，例如letterbox在邮政场景与画面黑边语境不同，仍需人工裁决。

全部646条R18蓝图在`adultEnabled=false`时，Anima/Krea共1292次规划调用均返回拒绝。[关闭成人开关测试](evidence/all-scene-audit/adult-disabled-planning-audit.json)。这只证明纯规划函数，不代替远程UI、隧道主机判定和生成接口验证；也不证明R18内容本身符合年龄/语义约束。

## 优先修复：非R18衣装错绑

对食蜂宿舍、黑呆黑裙、希耶尔花嫁的[修复前探针](evidence/all-scene-audit/sfw-outfit-guard-probes.json)确认：成人开关关闭时仍能得到`adult=false`但包含内衣词的计划。已将食蜂绑定新建的不透浅蓝丝绸长睡袍，希耶尔绑定有完整内衬的白婚纱，并重写对应中英文及动作；黑呆只把绑定改回现有哥特黑裙，未把原互动简化为独处来逃避难题。

食蜂与希耶尔各登记新衣装及原默认形态，4个形态×7机位共28个全部pending，不计完成参考资产。黑呆的旧内衣定义原本只被错误的全年龄场景引用，纠正后无场景或已登记参考使用，已退出当前菜单；[退出记录](evidence/all-scene-audit/retired-unused-outfit.json)保留原定义哈希和Git基线，未删除图片资产。其他仍有引用的服装未作此处理。

[两条重写交付](evidence/all-scene-audit/safe-binding-rewrite-delivery.json)与[黑呆单字段改绑](evidence/all-scene-audit/safe-binding-only-change.json)分开记录。重写入口退出成功，实际平均词条保留率58.1%、散文相似度0.19；58.1%高于它打印的50%建议值，检查器实际并未强制平均阈值，不能把退出成功宣传成该指标达标。没有通过改测试或删核心标签凑通过率。

[最终双引擎计划](evidence/all-scene-audit/safe-binding-final-dual-plans.json)在关闭成人开关时不再含内衣词，Krea负向为空。3条均真实出图：[逐图审核](evidence/all-scene-audit/safe-binding-visual-review.json)。食蜂第二次和希耶尔第一次通过衣装及主要道具核对，手部支撑位置和面部占比等偏差已记录；黑呆仍混入装甲、蓝色衣装与错误依靠对象，明确视觉失败待修，不发布、不计完整通过。

最初门禁暴露了本次新参考形态缺默认登记，以及黑呆旧定义变成无引用的实际问题，均已处理。最终[本轮全量门禁日志](evidence/all-scene-audit/safe-binding-gate-full.log)通过，耗时约1分49秒；仍未执行样张发布、浏览器双主题验收、桌面部署或Git写操作。第一大批完整审计未完成，全项目目标保持active。

## 第四轮：第二批源审计与远端检查点（2026-09-09）

第二批50角色、552条蓝图中，345条非R18标签场景全部逐条读取并核对了故事、动作、英文、标签、衣装、机位、尺寸和光照；244条有冲突或查证线索，101条未见重大内部冲突。已检查唯一ID覆盖与当前源哈希，没有遗漏、重复或未解释的源漂移。[整批摘要](evidence/all-scene-audit/old2-semantic-summary.json)。207条R18尚未完成深入语义、年龄资格及画面审核。

逐条证据：[01～05](evidence/all-scene-audit/old2-characters01-05-semantic-review.json)、[06～08](evidence/all-scene-audit/old2-characters06-08-semantic-review.json)、[09～14](evidence/all-scene-audit/old2-characters09-14-semantic-review.json)、[15～20](evidence/all-scene-audit/old2-characters15-20-semantic-review.json)、[21～27](evidence/all-scene-audit/old2-characters21-27-semantic-review.json)、[28～33](evidence/all-scene-audit/old2-characters28-33-semantic-review.json)、[34～39](evidence/all-scene-audit/old2-characters34-39-semantic-review.json)、[40～45](evidence/all-scene-audit/old2-characters40-45-semantic-review.json)、[46～50](evidence/all-scene-audit/old2-characters46-50-semantic-review.json)。约尔五条使用本会话最终修复快照重核，未沿用旧稿。

关键问题包括：拉普兰德居家白T/海滩比基尼仍绑佣兵/皮衣；佩丽卡恒温生态舱绑极寒装备；明日香黄泳装仍绑Q黑夹克眼罩且英文误名Asuna；2B白衬衫及婚纱分别绑战裙和黑礼服；C.C.米色风衣草帽绑黑骑士制服。枪械、容器、食物、发瞳色和双人接触的矛盾均有逐条证据。部分非R18条目实际带明显性化描写，必须先做年龄/分级资格评估，不允许按`adult=false`批量直接送去生成。

本轮没有继续更改源数据，先把已有54个受控文件复制到独立工作区`E:/code/2/lora/AI-CG-Studio-audit`。首次冷启动门禁因缺少SPA构建产物导致chat路由契约失败，已核对测试依赖并补构建；随后[独立工作区全量门禁](evidence/all-scene-audit/isolated-checkpoint-gate.log)通过（约1分53秒）。大型机器证据仅压缩JSON空白，经解析比较确认内容未变。精准提交并推送了[源检查点 ed1cef5a](https://github.com/starplatium1129-stack/ai-cg-studio/commit/ed1cef5a18303dd1f17721f4773ee491e726b25e)至`codex/all-scene-audit`，未混入其他会话代码，未合并main。以上日期较早的“未进行Git写操作”是当时状态，以本节检查点记录为准。

下一步为old-3的9角色/63条非R18源场景、独立302场景及新49当前交付证据对账；所有已发现问题的设定、真实画面、分级和修复闭环继续保留，不能以两批源码核对完成宣称全项目完成。
