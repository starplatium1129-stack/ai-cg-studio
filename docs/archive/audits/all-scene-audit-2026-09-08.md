# 全项目场景审计：目标与批次

> 历史审计快照（2026-09-12 整理）：正文保留当时证据，旧结论和下一步不代表当前状态或授权。当前事实见 [办公机独立审计](office-independent-audit-2026-09-12.md)，尚未完成及暂停事项见 [未来规划](../../roadmap.md)。归档不表示其中问题全部解决。

> 历史记录：本文保留原始结论与验证边界，归档不表示遗留事项已经完成。当前优先级见 [未来规划](../../roadmap.md)。

> 2026-09-09 范围纠正：按用户要求回退本会话新增的生成拦截及原有 NSFW 记录改动。此前禁用数量与对应验证为历史记录，不再代表当前状态。后续只审计 SFW，只有确认缺陷才修复，正常条目直接跳过。此前要求的成人分级保留，转出本任务。详见 [回退记录](../../evidence/all-scene-audit/scope-rollback.json)。回退全量门禁通过（[记录](../../evidence/all-scene-audit/scope-rollback-gate.txt)，1m53s），未提交 main。

> 最新进度（2026-09-09）：old-1与old-2共100角色、659条非R18标签场景已逐条核对内部语义，485条有问题或查证线索；两批414条R18仍为元数据初筛。正史、画面和完整分级验收尚未完成。源修复检查点已在独立分支提交并推送。机器可接续进度见 [progress.json](../../evidence/all-scene-audit/progress.json)。

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

具体角色及条目归属以[批次清单](../../evidence/all-scene-audit/summary.json)和[逐条台账](../../evidence/all-scene-audit/inventory.json)为准。角色批次覆盖该角色全部场景，不是每个角色只抽一条。

## 完成定义

逐条核对角色与作品设定、中文叙事/动作/英文散文/标签一致性、服装状态、镜头和尺寸、灯光与采样参数、分级及定稿字段、真实编译结果和图片证据。结构检查、语义审核、视觉验收分别记录；自动疑点不等于确认缺陷，编译通过不等于出图通过，历史样张存在不等于匹配当前提示词。

所有条目纳入覆盖统计。662 条 R18 条目当前只做元数据、绑定、分级和保护字段审计，不执行显式内容生成或扩写。1321 条非 R18 条目已使用现有编译流程检查：热门双引擎，独立场景目前为 Anima；独立场景 Krea 路径仍待核查。

## 当前发现

- 18 条花嫁服装绑定疑点已经逐条查看中文、英文与服装源，确认其中15条存在叙事与服装冲突；另外3条是可以兼容的形态变体，未误报为必改。[服装专项人工核对](../../evidence/all-scene-audit/outfit-semantic-review.json)。这只是服装维度，不计作18条完整审计完成。
- 优先问题：希耶尔全年龄白婚纱场景绑定透杯蕾丝内衣；贞德、斯卡哈、伊什塔尔、蕾娜等花嫁绑定战斗服或军装；2B、黑呆、诗羽白婚纱绑定黑礼裙。需同步维护服装与蓝图后真实出图，不靠添加婚纱标签覆盖冲突。
- 34 条夜景被推导为夕阳或日间窗光，是待逐条确认的编译疑点。
- 250 条热门散文短于200字符；266条独立场景没有显式尺寸。两者均为复核线索，不机械判错或补模板。
- 本次检查的 `2026-09-02_v27-miaomiao/manifest.json` 中，1666条没有对应可用图。该数仅是这一份样张清单的缺口，不能解释成全项目没有图片；尚需检索其他历史版本与候选目录。

## 本次验证与边界

`validate-scenes.js`：302场景通过。`optimize-scenes.js --check`：302场景、issues=0、5条可选格式建议；未写源数据。全量快照未出现缺失角色/服装ID、非 R18 编译失败或定稿字段漂移。输出保留[非 R18 编译证据](../../evidence/all-scene-audit/sfw-compiled-plans.json)及逐文件SHA256，执行期间检查源未变化。

本轮新增审计资料；未修改角色源、聚合产物、活跃样张清单，也未执行Git写操作。上轮共享工作区构建问题不能算成本轮数据审计失败或通过；本轮不宣称全量质量门禁完成。

## 接续工作

1. 以 old-1 的50角色/521条为第一大批。逐角色核对全部条目，优先处理已经确认的服装冲突及错误光照；非 R18 场景再做身份、动作、文本一致性和图像审核。
2. 对账全部样张版本和候选目录，记录源提示词/图片哈希以及是否真正看过原图；未看原图一律 pending。
3. 修复限于已确认且不被其他会话占用的条目；每条改动过完整性、编译和真实渲染，定稿条目遵守先出图再捕获基线。
4. 每批给出完整覆盖分母、确认问题、排除误报、修复数与未验收数；保持目标 active，全部覆盖完成前不标记完成。

本次一次性清单工具在被忽略的 `scripts/archive/all-scene-audit/`，未新增维护入口。后续若提升为常驻工具，须登记工作流并添加针对误报与覆盖完整性的回归验证。

## 第二轮推进：扩展样张对账与第一大批逐条审查

样张已从单一清单扩展为22份历史发布与候选清单；覆盖当前1983条源记录，其中1373条找到了图片文件，610条未在这些清单找到。313条有与当时当前MiaoMiao实际生成器的提示词、负向和所列参数一致的候选；文件存在或参数匹配仍不代表已看原图。第一大批521条里442条有历史图片、当时没有完全匹配的当前候选。此后本轮新生成的8条另见下方最终审核，不混入较早快照。[图片对账摘要](../../evidence/all-scene-audit/image-summary.json)、[逐图候选索引](../../evidence/all-scene-audit/image-inventory.json)。

已经逐条读取第一批前20角色的129条非R18场景，核对中文、action、英文、标签、服装、镜头、光照、尺寸；记录99条问题或设定查证线索。证据分为[前10人](../../evidence/all-scene-audit/old1-first10-semantic-review.json)、[黑贞/樱/摩根](../../evidence/all-scene-audit/old1-next3-semantic-review.json)、[玛修/卡莲](../../evidence/all-scene-audit/old1-next2-semantic-review.json)、[黑呆/贞德/斯卡哈/伊什塔尔/艾蕾](../../evidence/all-scene-audit/old1-next5-semantic-review.json)。其中3条阿尔托莉雅已由后述修复替代，审计基线哈希保留以追溯。

新发现包括：雷电将军海滨正文仍配暴雨夜景参数；芙莉莲荒原行走/花海站立、紫眼/金绿眼互相冲突；玛修白连体泳装正文/白比基尼英文；黑呆黑短裙场景绑内衣；卡莲身份琥珀眼却多数场景紫眼；多条two-shot叙事被统一solo守卫压制。斯卡哈身份散文直接夹带紫色战斗衣，真实编译时会混入旅装和婚纱。灯光推导甚至会把作品名Fate/stay night中的night判作月光，或把金色饰品判成夕阳；公共推导代码本轮尚未修改，避免未审全量的广泛变更。

正史来源开始单独登记：[官方来源记录](../../evidence/all-scene-audit/canonical-sources.json)。[Saber官方页](https://emiya-gohan.com/character/?chara=saber)仅支持其卫宫宅生活背景，不据文字页宣称颜色核验完成；[菲伦官方页](https://frieren-anime.jp/character/chara_group1/1-5/)提到通过一级考试，因此“希望成为三级”的旧蓝图必须确认时间线，而不能机械改写。

## 本轮已修复与复验

阿尔托莉雅汉堡、洗衣房、公园三条重写：统一现有蓝开衫白衬衣，消除黑西装/风衣、午后/午夜、散步/坐姿冲突；公园明确夕照，修复作品名误推月光。约尔上轮五条补齐老角色门禁要求的四个环境光影标签；红茶改为厨房桌边穿居家围裙倒茶，恢复围裙形态的场景覆盖。

初次全量门禁确实指出本会话遗漏的服装覆盖和光影词条，已修复，未修改测试标准。最终 [8条交付](../../evidence/all-scene-audit/owned-repairs-final-delivery.json)完整性8/8、词条保留47.4%、散文相似度0.08；[Anima编译](../../evidence/all-scene-audit/owned-repairs-final-anima-plans.json)与[Krea编译](../../evidence/all-scene-audit/owned-repairs-final-krea-plans.json)均保留，Krea本轮只编译未出图。

8条按最终提示词重新用MiaoMiao v1.2出图。约尔办公首次最终候选变成举起文件夹，第二次重出才恢复桌面整理纸张，拒绝的候选未计通过。已查看全部采用原图，核对SHA256、实际正负提示词及采样参数，记录可见次要偏差。[最终逐图审核](../../evidence/all-scene-audit/owned-repairs-final-visual-review.json)，原图在 `E:/code/2/lora/AI/Reviews/ShowcaseRefresh/2026-09-08-owned-repairs-final/`。

最终 `gate:full` 本次通过，包含check、前端、418个unit用例、25组接口契约及构建预算，耗时约2分2秒。[本次完整日志](../../evidence/all-scene-audit/owned-repairs-gate-full.txt)。尚未做浏览器双主题检查、桌面部署、样张发布或Git写操作；源分片/聚合已经更新，候选图尚未替换活跃样张。这些8条也不等于全部角色正史审核完成。

## 第三轮推进：完成第一大批非R18内部语义审查

剩余30角色185条均已逐条核对，未用自动标签检测冒充阅读。与前20人合计50角色、314条非R18记录无缺漏、无重复；241条记录内部冲突或正史查证线索，其余73条未发现重大内部冲突，仍不能据此算画面通过。[整批摘要与修复队列](../../evidence/all-scene-audit/old1-semantic-summary.json)。

详细证据：[21～26](../../evidence/all-scene-audit/old1-characters21-26-semantic-review.json)、[27～32](../../evidence/all-scene-audit/old1-characters27-32-semantic-review.json)、[33～36](../../evidence/all-scene-audit/old1-characters33-36-semantic-review.json)、[37～42](../../evidence/all-scene-audit/old1-characters37-42-semantic-review.json)、[43～50](../../evidence/all-scene-audit/old1-characters43-50-semantic-review.json)。发现幼年绿发/成年白发形态串入、学生宿舍睡袍绑内衣、方舟多条服装句截断、身体模板替代工作动作，以及森蚺蛇族/鳄族描述混杂等问题。

另外使用实际候选生成器检查全项目1035条非R18蓝图的正负向词条，找到13条字面冲突线索、2条白天字段推成月光的记录。[编译交叉检查](../../evidence/all-scene-audit/compiled-collisions.json)。字面命中不等于模型意义相同，例如letterbox在邮政场景与画面黑边语境不同，仍需人工裁决。

全部646条R18蓝图在`adultEnabled=false`时，Anima/Krea共1292次规划调用均返回拒绝。[关闭成人开关测试](../../evidence/all-scene-audit/adult-disabled-planning-audit.json)。这只证明纯规划函数，不代替远程UI、隧道主机判定和生成接口验证；也不证明R18内容本身符合年龄/语义约束。

## 优先修复：非R18衣装错绑

对食蜂宿舍、黑呆黑裙、希耶尔花嫁的[修复前探针](../../evidence/all-scene-audit/sfw-outfit-guard-probes.json)确认：成人开关关闭时仍能得到`adult=false`但包含内衣词的计划。已将食蜂绑定新建的不透浅蓝丝绸长睡袍，希耶尔绑定有完整内衬的白婚纱，并重写对应中英文及动作；黑呆只把绑定改回现有哥特黑裙，未把原互动简化为独处来逃避难题。

食蜂与希耶尔各登记新衣装及原默认形态，4个形态×7机位共28个全部pending，不计完成参考资产。黑呆的旧内衣定义原本只被错误的全年龄场景引用，纠正后无场景或已登记参考使用，已退出当前菜单；[退出记录](../../evidence/all-scene-audit/retired-unused-outfit.json)保留原定义哈希和Git基线，未删除图片资产。其他仍有引用的服装未作此处理。

[两条重写交付](../../evidence/all-scene-audit/safe-binding-rewrite-delivery.json)与[黑呆单字段改绑](../../evidence/all-scene-audit/safe-binding-only-change.json)分开记录。重写入口退出成功，实际平均词条保留率58.1%、散文相似度0.19；58.1%高于它打印的50%建议值，检查器实际并未强制平均阈值，不能把退出成功宣传成该指标达标。没有通过改测试或删核心标签凑通过率。

[最终双引擎计划](../../evidence/all-scene-audit/safe-binding-final-dual-plans.json)在关闭成人开关时不再含内衣词，Krea负向为空。3条均真实出图：[逐图审核](../../evidence/all-scene-audit/safe-binding-visual-review.json)。食蜂第二次和希耶尔第一次通过衣装及主要道具核对，手部支撑位置和面部占比等偏差已记录；黑呆仍混入装甲、蓝色衣装与错误依靠对象，明确视觉失败待修，不发布、不计完整通过。

最初门禁暴露了本次新参考形态缺默认登记，以及黑呆旧定义变成无引用的实际问题，均已处理。最终[本轮全量门禁日志](../../evidence/all-scene-audit/safe-binding-gate-full.txt)通过，耗时约1分49秒；仍未执行样张发布、浏览器双主题验收、桌面部署或Git写操作。第一大批完整审计未完成，全项目目标保持active。

## 第四轮：第二批源审计与远端检查点（2026-09-09）

第二批50角色、552条蓝图中，345条非R18标签场景全部逐条读取并核对了故事、动作、英文、标签、衣装、机位、尺寸和光照；244条有冲突或查证线索，101条未见重大内部冲突。已检查唯一ID覆盖与当前源哈希，没有遗漏、重复或未解释的源漂移。[整批摘要](../../evidence/all-scene-audit/old2-semantic-summary.json)。207条R18尚未完成深入语义、年龄资格及画面审核。

逐条证据：[01～05](../../evidence/all-scene-audit/old2-characters01-05-semantic-review.json)、[06～08](../../evidence/all-scene-audit/old2-characters06-08-semantic-review.json)、[09～14](../../evidence/all-scene-audit/old2-characters09-14-semantic-review.json)、[15～20](../../evidence/all-scene-audit/old2-characters15-20-semantic-review.json)、[21～27](../../evidence/all-scene-audit/old2-characters21-27-semantic-review.json)、[28～33](../../evidence/all-scene-audit/old2-characters28-33-semantic-review.json)、[34～39](../../evidence/all-scene-audit/old2-characters34-39-semantic-review.json)、[40～45](../../evidence/all-scene-audit/old2-characters40-45-semantic-review.json)、[46～50](../../evidence/all-scene-audit/old2-characters46-50-semantic-review.json)。约尔五条使用本会话最终修复快照重核，未沿用旧稿。

关键问题包括：拉普兰德居家白T/海滩比基尼仍绑佣兵/皮衣；佩丽卡恒温生态舱绑极寒装备；明日香黄泳装仍绑Q黑夹克眼罩且英文误名Asuna；2B白衬衫及婚纱分别绑战裙和黑礼服；C.C.米色风衣草帽绑黑骑士制服。枪械、容器、食物、发瞳色和双人接触的矛盾均有逐条证据。部分非R18条目实际带明显性化描写，必须先做年龄/分级资格评估，不允许按`adult=false`批量直接送去生成。

本轮没有继续更改源数据，先把已有54个受控文件复制到独立工作区`E:/code/2/lora/AI-CG-Studio-audit`。首次冷启动门禁因缺少SPA构建产物导致chat路由契约失败，已核对测试依赖并补构建；随后[独立工作区全量门禁](../../evidence/all-scene-audit/isolated-checkpoint-gate.txt)通过（约1分53秒）。大型机器证据仅压缩JSON空白，经解析比较确认内容未变。精准提交并推送了[源检查点 ed1cef5a](https://github.com/starplatium1129-stack/ai-cg-studio/commit/ed1cef5a18303dd1f17721f4773ee491e726b25e)至`codex/all-scene-audit`，未混入其他会话代码，未合并main。以上日期较早的“未进行Git写操作”是当时状态，以本节检查点记录为准。

下一步为old-3的9角色/63条非R18源场景、独立302场景及新49当前交付证据对账；所有已发现问题的设定、真实画面、分级和修复闭环继续保留，不能以两批源码核对完成宣称全项目完成。

## 继续执行与最新范围（2026-09-09）

用户恢复任务，并明确：全部SFW场景逐条审核、有问题逐条修复，完成后提交并推送main并停止；明显成人内容保留原文、改正成人分级，不回退改写成SFW。可以本地真实出图，但禁止看图和上传；所有新图由用户之后人工审核。本节取代早期审计备注里“成人内容修回SFW”的处置建议，也取代原目标中的成人内容深入优化、补参考图和本轮视觉验收要求。

old-3的9角色63条非R18源审查完成，56条有冲突或查证线索；老角色累计109人722条，541条线索。[old-3逐条记录](../../evidence/all-scene-audit/old3-semantic-review.json)。新49的71条交付源和编译快照全部一致，308条既有审核与当前生成参数可对应；5条有马加奈缺逐图审核记录。本轮只读取JSON，没有读取图片字节，不能把历史审核称作本轮看图通过。[新49对账](../../evidence/all-scene-audit/new49-current-reconciliation.json)。

独立场景已保存五批逐条证据：[第一批](../../evidence/all-scene-audit/studio1-semantic-review.json)、[第二批](../../evidence/all-scene-audit/studio2-semantic-review.json)、[第三批](../../evidence/all-scene-audit/studio3-semantic-review.json)、[第四批](../../evidence/all-scene-audit/studio4-semantic-review.json)、[第五批](../../evidence/all-scene-audit/studio5-semantic-review.json)。累计读取202条（分级变更前后的审查记录保留）；当前212条非R18中175条已有源审查、37条待续。该统计只涵盖明确列出的中文故事、英文caption、实际prompt、镜头、光照、时段与分级，不冒充全量日文翻译或视觉审核。

根据用户最新分级指示，74条明显成人记录改为R18/mature=true，原文保留；21条定稿记录仅改rating/mature，已核对其余锁定字段字节不变，并用既有capture入口同步基线。[分级逐条证据](../../evidence/all-scene-audit/adult-reclassification-2026-09-09.json)。旧人工评级表同步新限制，以免脚本再次降级；25条非定稿记录仅补adult分类标记满足既有契约，没有扩写成人内容或生成成人图，也没有更改角色年龄资格。[契约同步记录](../../evidence/all-scene-audit/adult-classification-contract-alignment.json)。这些分类不代表角色年龄已核实，用户人工审核仍待；单个含糊词命中没有机械升级。

11条非定稿SFW场景逐条重写，恢复圣诞礼物、手提凉鞋、篝火照片、台本、夜间游戏、超市甜品、泳后浴巾、赖床握腕、读书膝枕、水族馆看鱼与向日葵回眸。[重写交付](../../evidence/all-scene-audit/studio-safe-repair-delivery.json)。首次完整性11/11、词条保留49.5%、散文相似度0.20、模板雷同0；后续只同步分级及模型实际尺寸，最终检查仍需按当前稿复验。

本地网关未启动导致首次11条提交全部网络失败；启动仅本机网关后首轮11条全部生成。评级同步让其中5条最终负向改变，已启动第二次生成，不复用旧负向候选冒充最终一致。候选位于`E:/code/2/lora/AI/Reviews/SceneShowcaseRefresh/2026-09-09-sfw-audit-safe11`，全部未看图、未上传、待用户人工审核。

恢复后的全量门禁尚未最终通过：已处理尺寸格式、分级覆盖、adult契约标记、预压缩与DATA_VERSION同步；旧证据日志因文本卫生规则不接受.log，改为内容不变的.txt。语料测试仍硬编码旧草帽道具和“数据库必须存在错标项”，已按实际凉鞋修复及用户新分级更新断言，同时新增错标副本拒绝测试保留拦截验证。当前状态以[续接进度](../../evidence/all-scene-audit/progress.json)和当次新日志为准，未沿用历史PASS。尚未提交本轮代码或合入main，任务继续。

### 后续检查点

第六批37条也已逐条核对：[第六批源记录](../../evidence/all-scene-audit/studio6-semantic-review.json)。独立库累计239条有文本审查记录；在明显成人来源移出后，当前198条非R18源全部覆盖。分级复核又确认14条，总计88条改正成人分级、26条定稿记录仅更新分级字段：[补充分级记录](../../evidence/all-scene-audit/adult-reclassification-followup.json)。对最初基线检查确认52处差异全部是26条的rating/mature，定稿prompt/negative/caption/size原文未动。

首批11条最终候选均与当前源提示词、负向、模型/LoRA/采样参数一致，6条采用第一次、5条采用评级更新后的第二次；没有读取图片字节或打开图片。[供用户人工审核的清单](../../evidence/all-scene-audit/studio-safe11-human-review-queue.json)、[当前编译计划](../../evidence/all-scene-audit/studio-safe11-current-plans.json)。对应当前检查点全量门禁通过，耗时1分51秒：[完整日志](../../evidence/all-scene-audit/resumed-checkpoint-gate.txt)。针对修正后的黄金语料及生成边界的31项测试也通过；这些结果只适用于该检查点，不代替后续改动复验。

继续重写了第二组20条非定稿SFW源，累计31条；已过数据验证、评级对账无漂移，并启动本地候选生成。[第二组交付](../../evidence/all-scene-audit/studio-next20-delivery.json)。完整性覆盖20/20、无模板雷同、散文相似度0.25；词条保留率58.7%高于工具打印的50%建议值，实际检查器退出成功，不称该平均值达标。没有为凑指标删除正确身份锚点。第二组真实图仍在生成，未看图或上传；最终全量提交main尚未进行，老角色和独立库确认问题的修复队列继续处理。

编译裁决开始排除源码阅读的误报：Ciel与Shiki原始`dna_lock`并非解析器使用的`dnaLock`，而正确camelCase的avoid也只过滤常驻身份，不向负向注入。当前实际计划没有禁止眼镜、和服或短刀；因此初审中“DNA负向冲突”的推测不能当作成立。不过Ciel摘眼镜场景确实同时编译出glasses与glasses removed，Shiki脱夹克场景仍从服装注入夹克和持刀，这些实际冲突继续修复。未通过把无效配置自动激活来制造新限制。

### 当前修复与人工审核清单

第二组20条完成后，故事对齐门禁指出海滩失衡与婚纱转身缺少明确站立词，已补齐并为这两条再生成当前候选；18条采用第一次、2条采用第二次。[第二组人工审核清单](../../evidence/all-scene-audit/studio-next20-human-review-queue.json)。目前31条独立场景修复都有精确匹配当前源的候选。

老角色另完成5条绑定及叙事修复：希耶尔校服摘镜、两仪式白和服膝枕与白无垢、亚丝娜早餐托盘与湖畔膝枕。通过独立SFW衣装变体移除固定眼镜、红夹克、持刀或木勺，同时保留原来的袖口、膝枕和早餐互动；未修改它们原成人场景或共用成人衣装。[5条交付](../../evidence/all-scene-audit/old3-binding-repair-delivery.json)、[双引擎10条编译](../../evidence/all-scene-audit/old3-binding-dual-plans.json)、[5条人工审核候选](../../evidence/all-scene-audit/old3-binding-human-review-queue.json)。完整性工具退出通过、无模板雷同、散文相似度0.21；平均保留率65.7%仍高于打印建议，不宣称达标。新增5套衣装及2个原默认登记，共49个参考机位全部pending，不计资产交付。

对新49缺证据的加奈五条补查当前源后，精确修正了3条：围读帽子从常驻衣装移到桌面道具、落泪场景镜头改为肩上近景、夜祭灯光不再写白天。只改对应SFW字段和已有pending登记，未覆盖该系列其他角色或成人记录；[精确变更](../../evidence/all-scene-audit/new49-kana-precision-changes.json)。五条均生成当前候选，首条曾被满队列拒绝，随后单独重试成功。[加奈人工审核清单](../../evidence/all-scene-audit/kana-human-review-queue.json)。排练镜中反射仍是用户看图问题，没有因为一条clone守卫文本就宣布画面失败。新49当前313条非R18全部有参数匹配的生成元数据，308条保留对方既有审核记录、5条等用户人工审核；[初次对账](../../evidence/all-scene-audit/new49-initial-reconciliation.json)与[当前对账](../../evidence/all-scene-audit/new49-current-reconciliation.json)均保留。

本轮合计36条真实重写、3条精确SFW修正、2条补证据，共41条当前候选；全都没有打开图片或上传图片，视觉通过数仍为0。[汇总人工审核清单](../../evidence/all-scene-audit/current-human-review-queue.json)。最新全量门禁通过（1分53秒，包含418个unit用例、25组接口契约与构建预算）：[当前修复门禁](../../evidence/all-scene-audit/current-repairs-gate.txt)。历史失败已如上列明，未改测试去允许错标；错标副本仍必须被生成计划隔离。

[当前SFW修复队列](../../evidence/all-scene-audit/current-sfw-repair-queue.json)覆盖本会话的920条当前非R18源：683条仍待裁决或修复、190条未见重大内部冲突、46条已按新旧交付源匹配、1条黑呆仍保留旧视觉失败。683包含假设、设定查证及合理变体，不能等同683个已确认缺陷，也不能不经裁决机械全部重写。全项目尚未完成，所有本轮改动仍在独立工作区，未提交本轮代码、未合入main；按用户要求等全部确认SFW修复完成后统一提交推送main并停止。

## 镜头编译与雷电将军接续批次

雷电将军两条以成人展示为主体的旧记录只改成人分级及既有成人风格分类标识，原正文和正负词未扩写，未生成成人图。关闭成人开关时，两条在双引擎共4次规划调用均拒绝。其余4条逐条重写海滨、神社落樱、花海与咖啡馆，统一地点、时段、发辫、道具和动作；海滨不再被雨夜字段及day负向干扰。[分级与源变更](../../evidence/all-scene-audit/raiden-rating-and-repair-changes.json)、[4条交付](../../evidence/all-scene-audit/raiden-sfw-repair-delivery.json)、[双引擎编译](../../evidence/all-scene-audit/raiden-dual-plans.json)、[4条当前候选](../../evidence/all-scene-audit/raiden-human-review-queue.json)。完整性4/4、无模板雷同、散文相似度0.13；词条保留66.5%高于打印建议，未宣称该平均值达标。成人错标累计90条（88独立场景、2热门蓝图）。

真实编译发现，`looking_back`会凭关键词长度覆盖作者明确的medium/full-body镜头，`front view`还被错误映射为回眸。已使显式camera先于故事/标签推导，保留显式俯仰/POV的优先级，并将正面视图作为中性回退而非回眸。[1033条非R18计划的代码前后对比](../../evidence/all-scene-audit/camera-priority-impact.json)记录24条变化，不把此后精确源修正混作代码影响。24条里已有11条当前候选；其余13条仍需结合各自源问题裁决、修复及补生成，不能当作全库图像回归完成。

分级变更还暴露默认样张脚本按排序取首条蓝图的问题：现在仅选择该角色默认衣装对应的非成人蓝图，无合适候选则拒绝，不拿其他角色或成人条目兜底。全158角色的单测同时验证SFW资格与衣装一致，防止默认袍服被套入泳装场景。测试中的旧天守阁SFW固定样本换为仍属SFW的神社条目；额外负向保留测试使用独立副本，未为了测试把错误的day/neon排除词塞回实际海滨数据。

对镜头影响的新49九条逐条核对后，再精确处理5处：翔子赤足与凉鞋定义冲突；阳乃雪街单独使用闭合风衣及高跟长靴变体，咖啡馆旧衣装保留；十香落地场景改为能看见雨靴的全身镜头；爱瑠紫裙颜色与接雨滴动作同步；穹的Mary Jane改用鞋搭扣措辞。[精确变更](../../evidence/all-scene-audit/camera-followup-precision-changes.json)、[两条提示词精修交付](../../evidence/all-scene-audit/camera-followup-targeted-delivery.json)、[双引擎编译](../../evidence/all-scene-audit/camera-followup-dual-plans.json)。精修模式2/2通过，保留率95.8%、散文相似度0.94符合本次保留正确内容的精修性质，不冒充全量重写达标。新增7个参考视角仍全部pending。

上述九条已全部真实出图并核对实际任务元数据：[九条人工审核清单](../../evidence/all-scene-audit/camera-followup-human-review-queue.json)。汇总当前54条候选均在本地，未看图、未上传；视觉通过数为0。新49当前313条均有参数匹配的生成记录，其中299条仍能匹配旧人工审核，另14条待用户看新图；71条旧交付中69条原样匹配，十香/穹两条精修差异有独立证据，未抹掉旧快照。

已通过53项针对性测试、单体预算与最新完整门禁（1分51秒，418个unit用例、25组接口契约和构建）：[本批全量日志](../../evidence/all-scene-audit/director-and-raiden-gate.txt)。早期失败确实暴露了默认候选选择问题及过时测试假设，已分别修复生产逻辑与保留拦截能力的测试。一个“两仪式DNA禁止服装”的误报按实际编译排除，保留源哈希及编译器哈希：[裁决证据](../../evidence/all-scene-audit/current-sfw-adjudications.json)。当前自有918条非R18源队列为676条待裁决/修复、191条无重大内部冲突、50条源修复匹配、1条黑呆旧视觉失败。目标保持进行中，仍未合入main。

## 光照推导接续批次

将灯光推导从相机、情绪、英文整段及标签的混合字符串中分离。新模块`src/utils/blueprintLighting.ts`读取明确光照字段，并在适用时使用精确光照标签；作品名Fate/stay night、金色头发/眼睛不再触发月光或夕阳。夜间窗边霓虹不再默认加阳光；夜晚本身不代表月亮。已有字段明示的晨光、阳光等白天摄影配方仍保留，正午及人工发光不据颜色套用黄金时刻。月光、烛光、路灯、木窗/百叶窗等中英文来源单独识别。

初稿比对出现532条变化；补全中文灯窗别名并保留明确白天摄影配方后，最终1033条非R18计划中445条变化。[逐条代码前后计划摘要](../../evidence/all-scene-audit/lighting-priority-impact.json)。这不是445个已完成修复的独立场景，也不把它们都算已确认缺陷。全1033条均做了叙述/情绪/相机污染测试，结果证明改变这些无关字段不会改变灯光决策；31项热门角色测试、单体预算及全量门禁通过（1分48秒）：[全量日志](../../evidence/all-scene-audit/lighting-gate.txt)。

旧的54条本地候选逐条重新对账，最终5条失效并已换成新生成的对应结果；实际请求正负向、模型、画幅、采样参数与实际seed均由任务元数据核对。[当前候选对账](../../evidence/all-scene-audit/lighting-current-image-reconciliation.json)、[最新54条人工审核入口](../../evidence/all-scene-audit/current-human-review-queue.json)。中间版本额外生成的一张神社图未采用：保留明确晨光配方后，原图参数重新匹配，无需把不匹配的最新文件当成正确结果。旧分批清单已标为历史快照，以汇总清单为当前入口。全程未打开或上传图片，视觉通过仍为0。

445条里尚有440条需要结合源问题和当前生成结果继续对账。新49现有228条能匹配当前参数，85条旧结果因编译变化不再计为当前；214条旧人工审核还能匹配最新参数。早先313/299的数字只属于上一检查点，不能沿用为现在完成的证据。队列中的源审查状态与“灯光变更后需补生成”分别保存，未用源修复状态掩盖旧图失效。

另一个任务报告NSFW分支已推送至`2176aa20`并等待SFW完成后整合；此消息仅作为协调记录，未据此提前提交或覆盖main。继续按用户要求完成全部确认SFW修复后，再统一推送main并交接实际HEAD。当前目标仍未完成。

## 芙宁娜与首批光照候选更新

芙宁娜的礼帽从常驻身份移入官方礼服层，便服贝雷帽不再与小礼帽同时出现。同步参考定义但保留现有图片与URL；透明轻纱内衣形态改为成人参考标记，没有给旧资产新增视觉通过结论。四条逐条重写雨中露台、沙龙水形幻灵、海滨蛋糕叉与深夜咬笔构思；海滩另精确补全赤足全身机位。以中文原叙事为依据统一枫丹廷地点、绿罩台灯与暖黄光，没有凭空替换成别处或消除原本的幻灵互动。[变更](../../evidence/all-scene-audit/furina-repair-changes.json)、[重写交付](../../evidence/all-scene-audit/furina-rewrite-delivery.json)、[精修交付](../../evidence/all-scene-audit/furina-precision-delivery.json)、[14条双引擎编译](../../evidence/all-scene-audit/furina-dual-plans.json)。四条完整性通过、无模板雷同、散文相似度0.12；保留率76.6%高于打印建议，不称此平均值达标。七条SFW均有当前参数候选：[人工审核清单](../../evidence/all-scene-audit/furina-human-review-queue.json)。

钢琴条目sc220的日文仍写膝上面对面，与中文并排教学冲突，检索标签也残留跨坐。已同步日文位置、正负词与镜头，保留手把手引导琴键的互动；没有靠删掉互动来简化。精修模式通过并真实出图：[精修证据](../../evidence/all-scene-audit/piano-targeted-changes.json)、[交付](../../evidence/all-scene-audit/piano-targeted-delivery.json)、[候选](../../evidence/all-scene-audit/piano-human-review-queue.json)。这只是本条日文同步，不冒充全库日文审查。

逐条读完新49光照缺口的首20条，19条进入SFW补图；阳乃唱片机条目的原衣装明确仅敞衬衫且无下装，按用户要求保留原文、标成人并限制参考形态，不生成成人图。另精修迦摩的花饰箭与彩羽的一只猫耳发箍，后者明确为假耳装饰。没有因成年角色、普通时装或单一修辞就机械升级其他咖啡馆记录。[20条源审查与分级证据](../../evidence/all-scene-audit/new49-refresh20-source-review.json)、[精修交付](../../evidence/all-scene-audit/new49-refresh-targeted-delivery.json)、[19条候选](../../evidence/all-scene-audit/new49-refresh19-human-review-queue.json)。

本批一次性工具曾误将两份蓝图分片写为裸数组，既有加载/聚合校验立即拒绝。恢复了原version/franchise封装，保留全部当前181/42条记录；恢复前后数组哈希一致，没有从Git回滚已做的条目修复。工具已修正并加重复执行保护。随后完整门禁通过，耗时1分50秒：[本批全量日志](../../evidence/all-scene-audit/furina-refresh-gate.txt)。测试新增具体已改成人ID的SFW拒绝检查，原语义拦截并未削弱。

当前共81条本地候选匹配现源与实际任务参数，全部未看图、未上传。成人错标累计91条；新49当前312条非R18中247条已有匹配参数的生成记录，65条仍待处理。原445条灯光变更快照中29条已有当前候选、1条已按用户要求移到成人范围、415条仍待源与生成对账；匹配现在重算当前编译结果，不再拿修复前的固定哈希去误判新修复。自有队列剩671条线索待裁决或修复、56条源修复匹配、190条无重大内部冲突、1条黑呆旧视觉失败。全目标未完成，main仍未合入。

## 后续28条：发型、非性化日常与原作文字核对

本批逐条读取20条缺口及8条共享身份受影响的SFW源，共28条。[逐条源审查](../../evidence/all-scene-audit/refresh-next28-source-review.json)。惠的常驻短bob改为由SFW衣装分别指定：校服、白裙、婚纱保留短发，长发便服与厨房服装允许原场景要求的马尾。早坂爱的身份本来已经中性、夜间衣装也已明确散发，因此没有套用错误的“必须修发型”判断。

山田的初中生身份保留，删除常驻身份及普通SFW衣装/场景中不必要的身体部位强调。图书馆零食、摄影休息、分享芭菲与时装秀分别重写，保留日常核心；散发摄影休息使用独立便服变体，其他SFW场景延续既有马尾造型。校服明确正常覆盖，颈部痣与棕眼按现有身份统一。没有将角色改称成年人来处理这些SFW问题，也未改写或生成成人专属场景。[四条完整重写](../../evidence/all-scene-audit/refresh-next20-full-delivery.json)、[身份/衣装与精确变更](../../evidence/all-scene-audit/refresh-next20-changes.json)。完整性4/4、保留率44.2%、散文相似度0.22、无模板雷同；新增7个参考视角仍为pending。

同步栞那捧花中的咖啡豆和小白花、诗乃触蓝花的动作、真昼阳台针织衫绑定及山田浴衣场景痣的位置。[精修交付](../../evidence/all-scene-audit/refresh-next20-precision-delivery.json)。白银圭的邮筒使用mailbox以区分黑边抑制词letterbox，这是输入词义消歧，不宣称已经观察到旧图黑边：[消歧证据](../../evidence/all-scene-audit/postal-box-disambiguation.json)。重复标签清理前后实际模型输入相同，没有为它多算一条重绘。

另据[官方第1话梗概](https://otonarino-tenshisama.jp/story/season1-1/)与[BS日テレ节目介绍](https://www.bs4.jp/otonarino-tenshisama/)，确认初遇中是周把伞借给淋雨的真昼。旧稿的借伞方向写反，已修正为她接伞，并保留原有公园秋千环境；具体坐姿构图没有冒充官方剧照复刻。只读取官方文字，没有查看图片。[原作文字核对](../../evidence/all-scene-audit/mahiru-first-meeting-source-check.json)、[修正交付](../../evidence/all-scene-audit/mahiru-first-meeting-delivery.json)。本条完整性通过、保留率41.9%、散文相似度0.17。

28条最终候选均真实生成，白银圭邮筒及真昼借伞两条在最终修正后另出第二次，旧候选不计当前：[本批人工审核清单](../../evidence/all-scene-audit/new49-refresh28-human-review-queue.json)。新增单测防止SFW发型冲突、身体强调词回流及借伞方向反转；全量门禁通过，耗时1分49秒：[本批门禁](../../evidence/all-scene-audit/refresh-next28-gate.txt)。当前108条候选匹配现源和任务参数，全部未看图、未上传；新49当前267/312条有匹配生成记录，仍缺45条，灯光变更中仍有395条待源与生成对账。这些数字与旧源修复队列重叠，不相加冒充缺陷总数。全目标继续，尚未合入main。

## 后续15条：道具动作一致性

修复薰子浴衣服装固定单手动作与双手捧袋的冲突，同步参考标准；新条茜普通海边沙雕改为有小平木板承托再移动，保留原有非性化活动。[逐条审查](../../evidence/all-scene-audit/new49-batch3-source-review.json)、[精确变更](../../evidence/all-scene-audit/new49-batch3-precision-changes.json)。改写完整性命令通过，但该基线不包含此新蓝图，零相似度不能作为完整重写的质量结论。

15条已真实生成并与当前编译和任务元数据对账：[人工审核清单](../../evidence/all-scene-audit/new49-batch3-human-review-queue.json)。初次门禁在压缩尚未完成时启动，因旧压缩文件失败；完成压缩后重跑[完整门禁通过](../../evidence/all-scene-audit/new49-batch3-gate.txt)，保留[初次失败](../../evidence/all-scene-audit/new49-batch3-gate-first-failure.txt)。

另外读取剩余30条的中文描述、英文散文及服装，记录7项后续问题；未将这些字段的初审冒充全维审核：[后续清单](../../evidence/all-scene-audit/new49-final30-source-followup.json)。当前候选123条，视觉通过仍为0；新49匹配生成282/312，缺30条。灯光历史影响范围还有380条待当前源与候选对账，与其他队列重叠。继续审计，不提前提交main；未查看或上传图片。

## 后续28条：位置、造型与时间标签

逐条核对28条源，精确修复其中8条：床与扶手椅、婚纱花束、脱靴与水鞋、缝纫眼镜、共享粉发与金发、棚灯与夕阳词、清晨/夜间与黄昏字段、铁匠铺保养前后的时间片。[源审查](../../evidence/all-scene-audit/new49-batch4-source-review.json)、[变更](../../evidence/all-scene-audit/new49-batch4-precision-changes.json)、[双引擎编译](../../evidence/all-scene-audit/new49-batch4-dual-plans.json)。一次性编译脚本的Krea引擎参数已修正为krea2后重新生成证据。完整性命令通过；基线缺失导致零相似度，不称为完整重写认证。

28条最终候选与现源及任务元数据匹配，其中4条在后续修正后再出一次：[人工审核清单](../../evidence/all-scene-audit/new49-batch4-human-review-queue.json)。验证发现旧失败日志尾空格及删除夕阳后缺少棚灯标签，均已修复：[失败记录](../../evidence/all-scene-audit/new49-batch4-validation-failures.txt)、[最终完整门禁](../../evidence/all-scene-audit/new49-batch4-gate.txt)。

当前候选151条、视觉通过0；新49有310/312条匹配当前生成，剩2条。三格表情和乐队合奏与统一单人/禁分格限制冲突，另确认老角色伊莉雅骑肩也受影响：[当前编译证据和下一步](../../evidence/all-scene-audit/composition-followup-current-plans.json)。这些保持待修复，未把原意删成单人故事。灯光历史影响范围仍有352条待源与候选对账，队列重叠不相加。全目标未完成，尚未合入main，未看图或上传图片。

## 显式构图：三格表情与多人互动

新增可校验的compositionIntent字段，默认single，仅明确标记的SFW场景采用group或triptych。核心编译与候选入口共用规则：三格允许同一角色按格重复，多人允许同伴但仍压制意外克隆；成人场景仍使用原主体限制，远程与资格边界未放宽。未知字段值使蓝图无效。契约已写入工程文档。现有151条候选仍匹配原提示词和负面词。

逐条重写玛露希尔拒绝/尝试/追加三阶段表情、祥子五人假想和解合奏、伊莉雅骑Berserker肩头，同步标签、画幅及镜头：[变更](../../evidence/all-scene-audit/composition-repair-changes.json)、[当前双引擎编译与源审查](../../evidence/all-scene-audit/composition-current-plans.json)。真实生成3条并匹配现源和任务参数：[人工审核清单](../../evidence/all-scene-audit/composition-human-review-queue.json)。完整性命令通过，但两个新49条目不在旧基线，平均相似度不能全当成实测质量；未将单人故事替换掉原多人意图。

初次类型检查发现空蓝图参数未纳入辅助函数类型，修复后类型与完整门禁通过：[完整门禁](../../evidence/all-scene-audit/composition-gate.txt)，424条unit用例、耗时1分49秒。新增测试覆盖核心/候选双入口、三格负向冲突、多人去重、默认单人、非法值和成人拒绝边界。

当前154条自有候选全部未看图、未上传；新49的312条SFW均有当前匹配生成记录，但这不是全源/原作/视觉审核完成。保守统计仅95条有匹配当前源的本任务逐条审查记录，其余217条仍需与额外精修及其他任务证据对账：[源记录覆盖](../../evidence/all-scene-audit/new49-own-source-note-coverage.json)。老角色/独立场景仍有670条待判定或修复，另有旧Saber Alter视觉失败；灯光历史影响范围还有350条待对账。这些范围重叠，目标仍进行中，未合入main。

## 老角色三组19条：胡桃、狂三、芙莉莲

逐条重写胡桃7、狂三6、芙莉莲6条，统一动作/手部职责、空间位置、镜头和时段。包括枝头结印、账簿嗅花、双手托腮、晨光竹林、长短两枪、双手捧面碗、倚窗翻画册、荒原行走、驻足触碑与绿荫打盹。[交付](../../evidence/all-scene-audit/legacy19-repair-delivery.json)、[逐条审查](../../evidence/all-scene-audit/legacy19-source-review.json)、[变更](../../evidence/all-scene-audit/legacy19-repair-changes.json)、[胡桃变更](../../evidence/all-scene-audit/hutao-repair-changes.json)、[双引擎编译](../../evidence/all-scene-audit/legacy19-dual-plans.json)。完整性19/19，平均词条保留37.8%、散文相似度0.08，无跨条模板雷同。

胡桃听《三国演义》保留且明确为跨界想象；芙莉莲现代咖啡/超市保留为现代想象场景。狂三的永久哥特衣装描述从身份中移出，让校服与便服绑定生效。芙莉莲身份、角色档案及参考描述同步为银白双马尾和绿眼：双马尾由[授权厂商文字](https://tamashiiweb.com/item/16043/)支持，绿眼来自[作品百科文字](https://frieren.fandom.com/wiki/Frieren)，没有冒充原作图片验收。[来源强度和限制](../../evidence/all-scene-audit/frieren-text-source-check.json)。原有立绘及参考图未改动，也未查看；成人专属蓝图及服装未重写、未生成。

19条最终候选均真实生成并匹配现源/任务参数，狂三天台在横竖幅文字统一后补出一次：[人工审核清单](../../evidence/all-scene-audit/legacy19-human-review-queue.json)。完整门禁通过：[本批门禁](../../evidence/all-scene-audit/legacy19-gate.txt)。一次性编译检查起初按下划线匹配标签，实际规范化为空格，核对原文后已修正匹配方式；未因此改动正确的模型输入。

当前173条候选，视觉通过仍为0。老角色/独立场景待判定或修复降为656条，另有旧Saber Alter视觉失败；灯光历史影响范围仍有341条待当前源与图对账，范围重叠不相加。下一组已读取菲伦6条关键源字段并记录手持法杖、圣代餐具和时刻等问题：[后续记录](../../evidence/all-scene-audit/fern-next-source-followup.json)。全目标未完成，继续审计，尚未合入main。

## 菲伦、远坂凛12条：手部、服装与同一动作时刻

菲伦6条统一双手捧圣代/勺子放碟、车厢内膝上书、暂停抄写谢茶、舞前欠身与双手递热汤。持法杖和甜品叉不再写死在服装里；半束发与礼服盘发随服装绑定。普通SFW身份删除身体部位强调，未改年龄或资格，成人专属蓝图及服装未重写。早期修行明确为想象时段，不冒充已核实原作时间线。[变更](../../evidence/all-scene-audit/fern6-repair-changes.json)、[逐条编译与审查](../../evidence/all-scene-audit/fern6-current-plans.json)、[交付](../../evidence/all-scene-audit/fern6-repair-delivery.json)。

远坂凛6条统一抱臂/悬浮宝石、扶围网/回首、三枚宝石跃动、珠宝柜端详、落座后分享玉子烧及两手提购物袋。保留黑裙上的白色细格纹作为图案变化，无新增服装参考图交付。[变更](../../evidence/all-scene-audit/rin6-repair-changes.json)、[逐条编译与审查](../../evidence/all-scene-audit/rin6-current-plans.json)、[交付](../../evidence/all-scene-audit/rin6-repair-delivery.json)。

两组完整性命令均通过，无跨条模板雷同；菲伦词条保留48.3%、散文相似0.14，凛保留53.6%、散文相似0.12。凛保留率高于脚本打印的50%建议，不能把命令退出成功说成每项推荐指标都达标。12条均真实生成并匹配当前源/任务参数：[菲伦候选](../../evidence/all-scene-audit/fern6-human-review-queue.json)、[凛候选](../../evidence/all-scene-audit/rin6-human-review-queue.json)。[完整门禁](../../evidence/all-scene-audit/fern-rin-gate.txt)通过，参考图片文件未动，未看图或上传。

当前185条候选待人工看图，视觉通过0；老角色/独立场景待判定或修复646条，另有旧Saber Alter视觉失败。灯光历史范围待对账334条，与其他队列重叠。目标未完成，继续审计，尚未合入main。

下一组已读取间桐樱6条关键源字段，粉伞/透明伞、花卉图册/小说、挂绘马/行走等问题记录在[后续清单](../../evidence/all-scene-audit/sakura-next-source-followup.json)。尚未实施或出图，原作地点待核实。

## 间桐樱6条：道具与动作同步

统一厨房回首/木勺放托、出站口粉伞冬衣、射箭后放弓回首、绿壶支撑浇花、桌上花卉图册与噤声、挂绘马祈愿。厨房侧束发绑定到服装，普通身份去除身体部位强调；未改年龄或资格，成人专属蓝图未重写或生成。[变更](../../evidence/all-scene-audit/sakura6-repair-changes.json)、[交付](../../evidence/all-scene-audit/sakura6-repair-delivery.json)、[逐条审查和双引擎编译](../../evidence/all-scene-audit/sakura6-current-plans.json)。

[官方梗概](https://www.fate-sn.com/ubw/story/07.html)明确柳洞寺，[二手作品百科](https://typemoon.fandom.com/wiki/Ryuudou_Temple)将其定位到圆藏山；未查到旧“圆藏山神社”画面的确认依据。因此保留挂绘马意图，明确为冬木近郊的虚构小神社，不冒充原作地点再现，也不声称已证明山上不存在任何神社。[地点核对与限制](../../evidence/all-scene-audit/sakura-location-text-check.json)。

6条真实生成均匹配现源与任务元数据：[人工审核清单](../../evidence/all-scene-audit/sakura6-human-review-queue.json)。完整性命令通过，保留率56.8%高于打印的50%建议，散文相似度0.13，无模板雷同；不把退出成功说成全部建议指标达标。[完整门禁](../../evidence/all-scene-audit/sakura6-gate.txt)通过，现有参考图未动，未看图、未上传。

当前191条候选待人工看图；老角色/独立场景仍有641条待判定或修复，灯光历史范围仍有329条待对账，范围重叠。另仅读取黑呆旧视觉失败的文字记录，确认散发/发髻、同伴/单人限制等仍待解决：[后续记录](../../evidence/all-scene-audit/saber-alter-next-followup.json)。未重看旧图、未改判通过。目标继续，尚未合入main。

## 黑呆7条：服装绑定与旧失败的替换候选

新增宽松卫衣便服、冬日厚风衣、纯白婚纱三套SFW绑定，修正汉堡、雪中咖啡和白婚纱错误共用机车装/黑裙的问题。发型移到SFW服装：黑裙散发，其余发髻；人物档案同步。首次为该角色6套SFW衣装登记42个参考视角，全部pending空URL，没有把占位计作参考资产。[变更](../../evidence/all-scene-audit/alter7-repair-changes.json)、[交付](../../evidence/all-scene-audit/alter7-repair-delivery.json)。

七条逐条改写，明确双手举剑、汉堡、车把/头盔、擦酱惊讶、沙发同伴接触、两罐咖啡和白婚纱玫瑰。擦酱与沙发采用明确group构图；沙发黑裙散发与穿衬衫同伴的接触写清，避免不必要的身体部位强调，未改年龄/资格、未生成成人专属内容。[当前双引擎编译及审查](../../evidence/all-scene-audit/alter7-current-plans.json)。

七条真实生成并匹配当前源/任务参数：[人工审核清单](../../evidence/all-scene-audit/alter7-human-review-queue.json)。完整性命令通过，但旧基线缺这七条，零相似度不是实测改写质量。[完整门禁](../../evidence/all-scene-audit/alter7-gate.txt)通过。沙发源问题现在有替换候选，但保留[旧视觉失败及后续状态](../../evidence/all-scene-audit/saber-alter-next-followup.json)，没有重看旧图或把新图判作视觉通过。

当前198条候选全部待人工看图，未看图、未上传；老角色/独立场景仍有637条待判定或修复，灯光历史范围待对账324条，范围重叠。全目标仍未完成，尚未合入main。

## 黑贞6条：裙装、露台和持物分工

保留短裙叙事并新增独立黑夹克短裙变体，原皮裤装继续供其他场景使用，新增7视角均pending。黑铠服装不再写死手持旗帜：废墟一手旗一手剑，王座手中持剑而旗在支架上。海边选收刀完成时刻；露台递酒不再替成赌桌下注；雨夜天台一手栏杆一手抹雨，移除伞与卫衣。[变更](../../evidence/all-scene-audit/jalter6-repair-changes.json)、[交付](../../evidence/all-scene-audit/jalter6-repair-delivery.json)、[逐条审查与双引擎编译](../../evidence/all-scene-audit/jalter6-current-plans.json)。

6条真实生成并匹配现源与任务元数据：[人工审核清单](../../evidence/all-scene-audit/jalter6-human-review-queue.json)。完整性命令通过，保留率55.3%高于打印50%建议，散文相似度0.15，无跨条模板雷同；不将退出成功说成全部建议指标达标。[完整门禁](../../evidence/all-scene-audit/jalter6-gate.txt)通过。未看图或上传，成人专属蓝图未改写或生成，参考占位不计作图像交付。

当前204条候选待人工审核；老角色/独立场景仍有632条待判定或修复，灯光历史范围待对账320条，范围重叠不相加。目标继续，尚未合入main。

## 伊莉雅：五条重写与骑肩颜色更新

五条日常/幻想场景同步城堡背手回眸、雪地脚印张臂、冬木店外香草球甜筒、巨熊落地承重且脸埋绒毛、白天木马一手握柱一手挥手。[五条重写](../../evidence/all-scene-audit/illya5-rewrite-delivery.json)、[全部变更](../../evidence/all-scene-audit/illya6-repair-changes.json)、[当前编译及逐条审查](../../evidence/all-scene-audit/illya6-current-plans.json)。便服明确完整洋装/开衫/平底鞋，无年龄或资格变更。

旧红色冬装按多条二手文字修正为紫色，影响城堡与既有骑肩场景，骑肩只做颜色更新而非再次整条重写。[来源与限制](../../evidence/all-scene-audit/illya-coat-text-check.json)列出[2016年评论](https://taka1993.livedoor.blog/archives/2016-07.html)和[玩家讨论](https://gamefaqs.gamespot.com/boards/180151-fate-grand-order/77411073?page=5)；没有将这些资料当作官方图片验收，服装细节仍需用户复核。现有参考图片未改动或查看。

六条真实生成均匹配现源/任务参数，骑肩旧红色候选退出当前清单：[人工审核清单](../../evidence/all-scene-audit/illya6-human-review-queue.json)。五条完整性命令通过，保留率64.1%高于打印50%建议，散文相似度0.12，无模板雷同；不宣称全部建议指标达标。[完整门禁](../../evidence/all-scene-audit/illya6-gate.txt)通过。

当前209条候选待人工看图；老角色/独立场景还有630条待判定或修复，灯光历史范围待对账318条，范围重叠。[麻衣后续源记录](../../evidence/all-scene-audit/mai-next-source-followup.json)已列出图书馆分级适用性及其他日常道具问题，尚未修改或生成。未看图、未上传，目标继续，尚未合入main。

## 麻衣：一条受限分类与五条普通日常修复

[官方第1话](https://ao-buta.com/tv/story/01.html)确认图书馆场景发生在高中时期；[大学篇](https://ao-buta.com/santa/story/?id=1)不能回填为该场景的成年依据。原图书馆稿含性化服装描述，原文保留，分级改为R18并设generationBlocked，未增加“成年”提示词、未生成。[分类与核验证据](../../evidence/all-scene-audit/mai-library-classification.json)。分级是内容访问限制，不是对人物年龄的认证。

新增布尔字段generationBlocked：即使本机成人开关开启，也在蓝图可选性、Anima/Krea构建、直接候选和批量入口拒绝。维护CLI先按请求key筛选，再编译对应记录；默认候选也跳过被阻止的源。测试覆盖双引擎/双开关、非法字段类型、直接构建拒绝、受限CLI拒绝和普通key仍可生成。原有测试的成人分布、生成风格要求与批量数量曾失败；现在非生成记录不要求成人生成配方，且数量按可生成记录计算，并明确断言受限条目不进入计划。[初次验证记录](../../evidence/all-scene-audit/mai-block-initial-validation.txt)、[最终完整门禁](../../evidence/all-scene-audit/mai5-gate.txt)。

普通日常5条同步天台扶栏、钟楼站立伸手、眼镜针织帽与双盒食材/购物车、围裙锅柄锅铲、文集遮唇。新增风衣、采购伪装、围裙三套SFW服装和21个pending视角。[变更](../../evidence/all-scene-audit/mai5-repair-changes.json)、[交付](../../evidence/all-scene-audit/mai5-repair-delivery.json)、[编译与逐条审查](../../evidence/all-scene-audit/mai5-current-plans.json)、[5条候选](../../evidence/all-scene-audit/mai5-human-review-queue.json)。完整性命令通过，保留率55.4%高于打印50%建议、散文相似0.13，无模板雷同；不称全部建议指标达标。

当前214条候选均未看图或上传；受限图书馆条目不在其中。当前自有非成人范围917条，待判定或修复626条。成人内容重分类累计92条，其中麻衣这条另有生成阻止；灯光历史范围仍待对账315条、排除2条。全目标未完成，继续审计，尚未合入main。

## 摩根6条：位置、姿态与持物

恢复端坐王座、单手持枪立誓、雨后兜帽行走、齐膝水中站立咏唱、水边漫步和雪庭独立。冬之女王服装移除常驻圣枪，圣枪只在对应场景明确出现；森林补独立兜帽行旅变体，原宽檐帽版本保留，新增7个参考视角pending。水妃沿用既有白色挂颈泳装描述，不擅自宣称原作必为比基尼或连体款。[变更](../../evidence/all-scene-audit/morgan6-repair-changes.json)、[交付](../../evidence/all-scene-audit/morgan6-repair-delivery.json)、[逐条审查与双引擎编译](../../evidence/all-scene-audit/morgan6-current-plans.json)。不同形态的原作发色、服装细节和圣枪诠释未在本轮独立证实，不冒充官方图像还原。

6条真实生成并匹配当前源/任务参数：[人工审核清单](../../evidence/all-scene-audit/morgan6-human-review-queue.json)。改写命令通过，但旧基线不包含这些条目，零相似度不能当成改写质量实测。[完整门禁](../../evidence/all-scene-audit/morgan6-gate.txt)通过。另只读复查通用复审入口：buildPopularPrompt在核心拒绝返回null时抛错，不会继续拼接受限源；此处未做额外代码变更。

当前220条候选待人工审核，未看图或上传；当前自有非成人范围917条，仍有621条待判定或修复。灯光历史范围待对账313条，范围重叠。目标继续，尚未合入main。

## 玛修：五条普通场景与受限服装分类

走廊改为双臂抱纸文件，模拟盾防明确单膝支撑与受保护队友，海边按中文连体泳装踩浪，出击选握拳深呼吸时刻，食堂改为外套放椅背后用叉摆肉菜。白泳装移除bikini/crop_top冲突词，食堂新增独立脱外套变体及7个pending参考视角。[变更](../../evidence/all-scene-audit/mash5-repair-changes.json)、[交付](../../evidence/all-scene-audit/mash5-repair-delivery.json)、[当前编译与逐条审查](../../evidence/all-scene-audit/mash5-current-plans.json)。

Dangerous Beast的[官方商品文字](https://www.goodsmile.info/ja/product/7731)明确以性化表现介绍该礼装，但不提供当前场景的成年时期证明。原文保持，分类改为R18并generationBlocked，未改年龄、未添加成年提示词、未生成。[分类证据与限制](../../evidence/all-scene-audit/mash-dangerous-beast-classification.json)。双引擎/双开关/直接候选/CLI拒绝测试已覆盖麻衣和玛修两条，批量计划也断言二者均被排除。

普通5条真实生成并匹配现源/任务参数：[人工审核清单](../../evidence/all-scene-audit/mash5-human-review-queue.json)。改写命令通过，但旧基线不含这些条目，零分不作为质量实测。[完整门禁](../../evidence/all-scene-audit/mash5-gate.txt)通过，未看图或上传；受限服装场景不在候选中。

当前225条候选待人工看图，当前自有非成人范围916条，待判定或修复616条。成人内容重分类累计93条，其中两条额外禁止生成；灯光历史范围待对账312条，范围重叠。目标继续，尚未合入main。

## 卡莲：三条普通场景与年龄敏感内容限制

暖汤、热可可和完整礼服三条同步琥珀眼与短发、双手托物及明确的动作时刻，默认SFW服装改为完整红色冬大衣。[变更](../../evidence/all-scene-audit/caren3-repair-changes.json)、[交付](../../evidence/all-scene-audit/caren3-repair-delivery.json)、[当前编译及逐条审查](../../evidence/all-scene-audit/caren3-current-plans.json)。三条真实生成并匹配现源/任务参数：[人工审核清单](../../evidence/all-scene-audit/caren3-human-review-queue.json)。旧改写基线不含这三条，命令通过及零相似度不作为改写质量实测。[完整门禁](../../evidence/all-scene-audit/caren3-gate.txt)通过。

另外五条原SFW稿使用裸露/身体曲线强调的衣装与表达，转为R18；该角色既有五条R18也一并标记generationBlocked。全部原文保留，未增加成年提示词、未生成。[分类记录](../../evidence/all-scene-audit/caren-restricted-classification.json)包含限制依据与[二手时间线讨论](https://capricciosa0807.blog.fc2.com/blog-entry-57.html)，不冒充确定的官方年龄证明。默认许可不能当作具体剧情成年证据。当前十二条被阻止的记录均由双引擎、双开关、直接候选与CLI拒绝测试覆盖；批量计划排除这些记录。

当前228条候选待人工看图，未查看或上传图片；自有非成人范围911条，待判定或修复609条。成人内容重分类累计98条，另有合计12条禁止生成；灯光历史范围待对账307条，范围重叠。一次性证据登记命令因引号问题未执行，已改为本地脚本并验证登记；源修复与最终门禁不受影响。目标继续，尚未合入main。

## 贞德7条：圣旗名称、卸甲与发型绑定

[授权厂商文字](https://www.goodsmile.info/ja/product/6682/figma%2B%E3%83%AB%E3%83%BC%E3%83%A9%E3%83%BC%2B%E3%82%B8%E3%83%A3%E3%83%B3%E3%83%8C%2B%E3%83%80%E3%83%AB%E3%82%AF.html)明确旗帜为Luminosité Éternelle，并介绍展开/闭合旗帜部件；旧稿误用La Pucelle，已同步场景、服装和人物摘要。[名称证据](../../evidence/all-scene-audit/jeanne-banner-text-check.json)使用索引文字，短网址打开曾返回工具错误，未重试或查看图片。

补齐卸甲祈祷裙、室内散发便服、夜市披肩、纯白婚纱四套SFW绑定；发辫按服装选择，散发梳头不再受固定长辫和草帽干扰。祈祷与婚纱负面明确避免胸甲/护手/旗帜回流。麦田花束放入藤篮腾出手触麦穗，海边一手遮阳一手防晒瓶，夜市双手可丽饼。[变更](../../evidence/all-scene-audit/jeanne7-repair-changes.json)、[交付](../../evidence/all-scene-audit/jeanne7-repair-delivery.json)、[当前编译和逐条审查](../../evidence/all-scene-audit/jeanne7-current-plans.json)。该角色原参考清单为空，现登记7套SFW衣装共49个pending视角，不计作参考图交付。

7条真实生成并匹配当前源/任务参数：[人工审核清单](../../evidence/all-scene-audit/jeanne7-human-review-queue.json)。改写命令通过，但旧基线不含这些记录，零相似度不代表实测质量。[完整门禁](../../evidence/all-scene-audit/jeanne7-gate.txt)通过。未看图、未上传，成人专属源未改写或生成。

当前235条候选待人工审核；自有非成人范围911条，待判定或修复604条，灯光历史范围待对账305条，范围重叠。目标继续，尚未合入main。

## 斯卡哈7条：移除常驻紧身衣与补齐夜谈构图

紧身衣从共享身份移出，仅保留在战斗服装；其他SFW场景负面明确避免紫色紧身衣回流。新增白衫长裤茶室装、脱外套夜谈装和白婚纱；首次登记该角色6套SFW衣装共42个pending参考视角，不计作参考图交付。逐条同步双枪分工、树枝拨柴、摇杆/按钮、茶筅放好后推碗、果汁与支撑手、外套盖同伴膝上的双人后侧横幅、婚纱伸手。[变更](../../evidence/all-scene-audit/scathach7-repair-changes.json)、[交付](../../evidence/all-scene-audit/scathach7-repair-delivery.json)、[当前编译和逐条审查](../../evidence/all-scene-audit/scathach7-current-plans.json)。原幻想誓言与项目武器诠释保留，不作为新增原作事实认证。

7条真实生成并匹配当前源/任务参数：[人工审核清单](../../evidence/all-scene-audit/scathach7-human-review-queue.json)。改写命令通过，但旧基线不含这些记录，零相似度不代表实测质量。[完整门禁](../../evidence/all-scene-audit/scathach7-gate.txt)通过；未看图、未上传，成人专属源未改写或生成。

当前242条候选待人工审核；自有非成人范围911条，待判定或修复598条，灯光历史范围待对账301条，范围重叠。目标继续，尚未合入main。

## 埃列什基伽勒7条：宝具、持物与冥界灯光

[授权厂商文字](https://www.goodsmile.info/ja/product/7697/%E3%81%AD%E3%82%93%E3%81%A9%E3%82%8D%E3%81%84%E3%81%A9%2B%E3%83%A9%E3%83%B3%E3%82%B5%E3%83%BC%2B%E3%82%A8%E3%83%AC%E3%82%B7%E3%83%A5%E3%82%AD%E3%82%AC%E3%83%AB.html)将枪型宝具称为发热神殿Meslamtaea，修正旧稿把Kur Kigal Irkalla用作手持兵器名称的问题；同步人物摘要。[命名证据](../../evidence/all-scene-audit/eresh-weapon-text-check.json)。黑裙定义移除固定持杖与固定脚下光效，王座手扶兵器、花田提裙招手、河畔抱膝各自明确。首次日出补落地兵器，泳池移除day自然日光词，河畔group双人横幅，婚礼新增白裙金冠绑定。初雪/首次日出/婚礼明确为想象情节，不宣称原作历史事件。[变更](../../evidence/all-scene-audit/eresh7-repair-changes.json)、[交付](../../evidence/all-scene-audit/eresh7-repair-delivery.json)、[当前编译和逐条审查](../../evidence/all-scene-audit/eresh7-current-plans.json)。该角色4套SFW衣装共28个新参考视角均pending。

7条真实生成并匹配当前源/任务参数：[人工审核清单](../../evidence/all-scene-audit/eresh7-human-review-queue.json)。改写命令通过，但旧基线不含这些记录，零分不作为质量实测。[完整门禁](../../evidence/all-scene-audit/eresh7-gate.txt)通过，未看图或上传，成人专属源未改写或生成。

当前249条候选待人工审核；自有非成人范围911条，待判定或修复592条，灯光历史范围待对账298条，范围重叠。目标继续，尚未合入main。

## 伊什塔尔：六条修复、天舟和金星时段

[授权厂商文字](https://www.goodsmile.info/ja/product/7145/%E3%81%AD%E3%82%93%E3%81%A9%E3%82%8D%E3%81%84%E3%81%A9%2B%E3%82%A2%E3%83%BC%E3%83%81%E3%83%A3%E3%83%BC%2B%E3%82%A4%E3%82%B7%E3%83%A5%E3%82%BF%E3%83%AB.html)确认Maanna名称；旧稿无依据山峰名、维纳斯天舟混称和中文英文碎片已清理。[NASA说明](https://science.nasa.gov/earth/earth-observatory/viewing-venus-from-the-space-station-145213/)支持金星在晨昏接近地平线的常见地表观测条件，观星场景改为日落后西方低空、双人横幅，不承诺某一日期必然可见。[来源与限制](../../evidence/all-scene-audit/ishtar-text-source-check.json)。

现代便服固定星形发夹，供品场景不再串入天舟，圣诞补完整冬装及礼物袋落地，婚礼补白纱花冠并明确为想象誓约。共新增两套SFW服装，该角色四套可用SFW衣装登记28个pending参考视角。[变更](../../evidence/all-scene-audit/ishtar6-repair-changes.json)、[交付](../../evidence/all-scene-audit/ishtar6-repair-delivery.json)、[当前编译与逐条审查](../../evidence/all-scene-audit/ishtar6-current-plans.json)。泳池原稿性化评审内容保留，R18并generationBlocked，未改成年或生成：[分类记录](../../evidence/all-scene-audit/ishtar-pool-classification.json)。

6条普通场景真实生成并匹配现源/任务参数：[人工审核清单](../../evidence/all-scene-audit/ishtar6-human-review-queue.json)。改写命令通过，但旧基线不含这些记录，零分不作为质量实测。[完整门禁](../../evidence/all-scene-audit/ishtar6-gate.txt)通过，十三条受限记录已覆盖生成拒绝测试。未看图、未上传。

当前255条候选待人工审核；自有非成人范围910条，待判定或修复586条。成人内容重分类累计99条，13条禁止生成；灯光历史范围待对账293条，范围重叠。全目标未完成，尚未合入main。

## 初音未来6条：动作、耳机与官方年龄

[官方资料](https://piapro.net/pages/character)明确设定年龄16岁，adultEligibility修正为underage。原有四条R18原文保留并generationBlocked，未改成年、未生成：[受限记录](../../evidence/all-scene-audit/miku-restricted-records.json)。已识别R18手动词条、服装/换装覆盖与复审追加词会拒绝，加权形式经normalizeKey规范化后同样拒绝；测试同时验证普通场景仍可构建。原先场景总数断言误将资格变化当成新增数量，以及对受限存档要求扩写，已纠正：[初次验证](../../evidence/all-scene-audit/miku6-initial-validation.txt)。

6条同步舞台跃起、录完摘耳机挥手、葱绿浴衣与大葱造型棒棒糖、试听分享耳罩、店内两种冰品选择、滨海晨跑。新增卫衣便服和7个pending视角；耳机从常驻身份移到场景。V2组件参考[官方服装清单](https://blog.piapro.net/2012/10/post-581.html)，灰色无袖上衣、青绿领带和深色下装/鞋履使用[二手游戏造型说明](https://project-diva.fandom.com/wiki/Hatsune_Miku)，未查看图片确认精确鞋履结构。[来源与限制](../../evidence/all-scene-audit/miku-text-source-check.json)、[变更](../../evidence/all-scene-audit/miku6-repair-changes.json)、[交付](../../evidence/all-scene-audit/miku6-repair-delivery.json)、[当前编译与逐条审查](../../evidence/all-scene-audit/miku6-current-plans.json)。

6条真实生成并匹配现源/任务参数：[人工审核清单](../../evidence/all-scene-audit/miku6-human-review-queue.json)。改写命令通过，词条保留65.3%高于打印50%建议，散文相似0.12，无模板雷同；不宣称全部推荐指标达标。[最终完整门禁](../../evidence/all-scene-audit/miku6-gate.txt)通过。加权控制词修复前后，当前261条候选仍匹配，没有为该代码修复多算新图。

当前261条候选待人工看图，未看图、未上传；已有17条源禁止生成。自有非成人范围910条，待判定或修复581条，灯光历史范围待对账291条，范围重叠。目标继续，尚未合入main。

## 楪祈6条：官方年龄与完整着装互动

[官方角色页](https://guilty-crown.jp/character/)明确楪祈16岁，adultEligibility改为underage。既有4条R18保留但generationBlocked，未改成年或生成：[受限记录](../../evidence/all-scene-audit/inori-restricted-records.json)。未成年控制词拒绝测试现覆盖初音和楪祈。分类证据已统一为ID、哈希与变更字段，21条逐条验证正文哈希不变，避免在报告复制受限原文；原稿仍留在原数据中。

普通6条同步闭眼歌唱、废都拉衣角、临海天台温红茶、白百合、曲奇而非蛋糕、地下车厢隧道灯。废都与地铁明确原对话点名的桜满集，并按group构图展示完整着装同伴；两条在补足姓名后出第二版。新增烘焙围裙便服及7个pending视角。项目长袖舞台裙保留，不宣称它就是官方金鱼服。[变更](../../evidence/all-scene-audit/inori6-repair-changes.json)、[交付](../../evidence/all-scene-audit/inori6-repair-delivery.json)、[当前编译与逐条审查](../../evidence/all-scene-audit/inori6-current-plans.json)。

6条最终候选真实生成并匹配现源/任务参数：[人工审核清单](../../evidence/all-scene-audit/inori6-human-review-queue.json)。改写命令通过，词条保留55.3%高于打印50%建议，散文相似0.10，无模板雷同；不宣称所有建议指标达标。[完整门禁](../../evidence/all-scene-audit/inori6-gate.txt)通过。未看图、未上传，视觉判定全部留给人工。

当前267条候选待审核；自有非成人范围910条，待判定或修复576条，灯光历史范围待对账286条，范围重叠。目标继续，尚未合入main。

## 雪乃6条：冬装、公共图书馆与餐桌道具

[官方资料](https://www.tbs.co.jp/anime/oregairu/2nd/personal/chara02.html)明确高中二年级，[二手年龄记录](https://anilist.co/character/67067/Yukino-Yukinoshita)给出16—17岁范围；不将具体数字冒充官方原文。adultEligibility改为underage，既有4条R18保留并禁止生成，以重建前状态的哈希验证原文未变：[受限记录](../../evidence/all-scene-audit/yukino-restricted-records.json)。

普通6条同步侍奉部读书、冬大衣围巾、公共图书馆小说、汉堡肉刀叉、两杯纸杯咖啡和暖桌猫玩偶。冬装唯一关联的旧snow_dress标识保留，错误白礼服定义改为大衣围巾；暖桌新增针织家居服及7个pending参考视角。[变更](../../evidence/all-scene-audit/yukino6-repair-changes.json)、[交付](../../evidence/all-scene-audit/yukino6-repair-delivery.json)、[当前编译与逐条审查](../../evidence/all-scene-audit/yukino6-current-plans.json)。

6条真实生成并匹配现源/任务参数：[人工审核清单](../../evidence/all-scene-audit/yukino6-human-review-queue.json)。改写命令通过，保留率58.1%高于打印50%建议，散文相似0.13，无模板雷同；不宣称全部建议指标达标。[完整门禁](../../evidence/all-scene-audit/yukino6-gate.txt)通过，未看图、未上传，现有参考图片仍需人工复核。

当前273条候选待审核；自有非成人范围910条，待判定或修复571条，灯光历史范围待对账281条，范围重叠。已有25条源禁止生成。目标继续，尚未合入main。

## 恢复后：仅修明确错误，统一 MiaoMiao

按用户最新指示，后续本任务出图统一 MiaoMiao v1.2；独立场景可经 showcase:scene-candidates 指定 ID 生成，不发布。旧候选不因模型偏好自动重出。首轮重新判定18项：14项保留原样、4项只修中文说明或检索字段；双引擎实际生成文本与尺寸相等，没有重复出图。证据：[角色与一条独立场景](../../evidence/all-scene-audit/minimal-adjudication-2026-09-09.json)、[独立场景微差裁决](../../evidence/all-scene-audit/studio-minor-adjudication.json)。当前待判定553条，不能当作553个已确认缺陷。NSFW源与生成权限本轮未修改。所有图像仍待用户人工审核。

追加[第二组12项裁决](../../evidence/all-scene-audit/minimal-followup-adjudication.json)：8条跳过、4处纯文字/分类纠正，生成文本均未变化。恢复后累计30项，22条保留原样、8条元数据纠正，待判定降至541条。模型选择与首组修改的[全量门禁](../../evidence/all-scene-audit/minimal-miaomiao-gate.txt)通过1m49s；追加四处元数据改动已重建并通过分片契约与差异检查，不将此前全量PASS冒充追加改动后的全量验收。未生成图片、未修改NSFW源。

## 用户要求提前提交当前检查点

本次提交保留未完成状态：541条仍待判定，不能声称全部SFW审计完成。提交前[全量门禁](../../evidence/all-scene-audit/main-checkpoint-gate.txt)通过1m54s；逐条对比原有662条成人源记录与本分支既有检查点，记录内容一致。此前新增生成禁用与资格改动已撤回。后续任务生成统一MiaoMiao v1.2；历史候选未自动换模，所有当前候选继续等待用户人工视觉审核。提交/推送结果以Git实际记录为准。

## main检查点之后的继续审计

在68fba3d6之后追加[6条连续动作疑点裁决](../../evidence/all-scene-audit/moment-review-adjudication.json)：5条保留原样，艾雅法拉温泉测温一条只将动作元数据与既有英文蹲姿统一。双引擎生成文本和尺寸前后一致，无新出图；蓝图重建及差异检查通过，未重复全量门禁。当前535条待判定；本段为检查点之后的工作，未包含在68fba3d6中。

## 三条真实负向冲突的最小修复

只删除莱万汀工坊/火锅及伊冯工坊与当前身份、衣装、场景相反的负向词，正向正文未重写，共三条SFW。见[字段差异](../../evidence/all-scene-audit/negative-conflicts3-changes.json)、[实际编译结果](../../evidence/all-scene-audit/negative-conflicts3-compiled.json)。三条MiaoMiao v1.2候选生成及参数对账成功，[人工队列](../../evidence/all-scene-audit/negative-conflicts3-human-review-queue.json)保留视觉待审；当前276条候选对账通过，无看图或上传。伊冯转一把枪并不排除另一手持枪，余下微动作不构成必要重写。希耶尔厨房眼镜冲突误报已排除，另[七条DNA疑点](../../evidence/all-scene-audit/remaining-dna-compiler-probes.json)也未在实际负向词出现，其他源问题仍待判定。当前待判定531条。[全量门禁](../../evidence/all-scene-audit/negative-conflicts3-gate.txt)通过1m53s；本轮未追加提交main。

## 三条字段纠正与三条双人构图修复

[动作字段三条](../../evidence/all-scene-audit/action-metadata3-adjudication.json)仅纠正洛琪希调料罐、和纱长椅及白夜坐位/检索发色，双引擎生成文本与尺寸前后一致，不重出图。[食蜂三条](../../evidence/all-scene-audit/misaki-composition3-changes.json)本来明确two-shot却受单人守卫排斥，现仅设置group构图，保留源故事、衣装、画幅与正向词；[三张MiaoMiao候选](../../evidence/all-scene-audit/misaki-composition3-human-review-queue.json)均生成成功并完成元数据对账，未看图、未上传。60项热门/候选契约通过，279条当前候选对账通过；未在本轮重复全量门禁或追加提交main。剩余525条待判定。

## 伊蕾娜五条待办

按已说明的临时默认方案，夜间魔法、甜品店、雨天书店三条仅将中文说明对齐原有自洽的生成内容；[逐项前后记录](../../evidence/all-scene-audit/elaina-minimal5-changes.json)保留原中文与选择依据，双引擎生成文本及尺寸逐项不变。此偏好尚未得到用户单独选项确认，不写成用户已确认。市集魔女袍绑定修正、屋顶扫帚负向冲突移除后，[两条MiaoMiao候选](../../evidence/all-scene-audit/elaina-render2-human-review-queue.json)真实生成并完成参数对账。60项相关契约通过，281条当前候选对账通过；图像均未查看或上传。当前520条待判定，未在本轮重复全量门禁或追加提交main。

## 雷姆与爱蜜莉雅日常源裁决

[雷姆六条](../../evidence/all-scene-audit/rem-minimal6-adjudication.json)：走廊端茶、雨夜牵手和书店三条保留；月夜浇花纠正水壶修剪及花种，咖啡厅明确爱心已画好并修正咖啡托盘字段，烘焙坊中文同步既有法棍篮子画面。[爱蜜莉雅两条](../../evidence/all-scene-audit/emilia-metadata2-adjudication.json)只纠正雪林错误跪姿字段与花束中文花种。八条中五条仅文案/元数据改动，双引擎生成文本和尺寸均未改变，没有重复出图。蓝图重建、分片契约与差异检查通过；本轮未重复全量门禁或提交main。剩余512条待判定，视觉验收仍由用户完成。

## 木更三条日常待办

[学校与便利店](../../evidence/all-scene-audit/kisara-text2-adjudication.json)只同步镜头描述和中文采购文案，双引擎生成内容及尺寸未变。居家账单场景中英文均要求白衬衫但旧绑定注入夹克牛仔裤，已[新增对应SFW居家衣装并改绑](../../evidence/all-scene-audit/kisara-home1-binding-change.json)，保留原场景正文与角色身份；7个参考机位全为pending占位，不计真实资产。[双引擎编译](../../evidence/all-scene-audit/kisara-home1-compiled.json)确认不再混入旧外套裤型，[一张MiaoMiao候选](../../evidence/all-scene-audit/kisara-home1-human-review-queue.json)生成成功，未看图或上传。60项相关契约及282条当前候选对账通过，剩余509条待判定。本轮未重复全量门禁或追加提交main。

## 五条镜头/姿态旧疑点

[逐条裁决](../../evidence/all-scene-audit/camera-metadata5-adjudication.json)：洛琪希村落、艾莉丝训练与凯尔希荒漠仅修正camera描述中的坐车/练后擦汗/看扫描仪，与既有正文一致；实际双引擎生成文本及尺寸均未改变。洛琪希荒野驻杖与行走、陈凭栏与按剑均存在兼容解释，未发现必须改写的排他冲突，原样保留。五条无需重新出图；蓝图重建、分片契约和差异检查通过。当前504条待判定，未重复全量门禁或追加提交main。

## 卡芙卡三处局部错配

[三条差异与编译记录](../../evidence/all-scene-audit/kafka-minimal3-changes.json)：酒店中文红酒杯同步为原生成已有的香槟杯，双引擎实际生成内容不变；雨巷将英文双枪改为一手冲锋枪一手伞，标题移除双枪字样；舷窗英文burgundy coat纠正为所选衣装的black leather coat。后二条[两张MiaoMiao候选](../../evidence/all-scene-audit/kafka-render2-human-review-queue.json)生成成功并核对参数，未查看或上传图片。60项相关契约及284条当前候选对账通过；当前501条待判定，本轮未重复全量门禁或追加提交main。

## 蕾塞四条旧疑点裁决

[逐条记录](../../evidence/all-scene-audit/reze-minimal4-adjudication.json)：电话亭实际编译保留夜间霓虹，overcast只带柔和漫射光，没有日光词，不能认定雨夜冲突；摩天轮英文未把人物指定在座舱外，衣装亦未禁止披穿，风险线索不当作真实失败，两条原样保留。泳池仅修正camera中错误的坐池边姿态，书店中文诗集同步为现有英文时尚杂志；两条双引擎生成文本及尺寸前后一致，无重复出图。蓝图重建、分片契约与差异检查通过；当前497条待判定，未重复全量门禁或追加提交main。

## 玛奇玛四条剩余日常裁决

[三条字段裁决](../../evidence/all-scene-audit/makima-metadata3-adjudication.json)中，遛狗与支配之夜只修动作/镜头描述，双引擎生成文本及尺寸不变；办公室外套可覆在西装外，保留原绑定。电影院[英文称呼](../../evidence/all-scene-audit/makima-cinema1-change.json)由Sensei同步为中文已有的Denji，[一张MiaoMiao候选](../../evidence/all-scene-audit/makima-cinema1-human-review-queue.json)真实生成并完成参数对账。60项相关契约和285条当前候选对账通过，未查看或上传图片。当前493条待判定，未在本轮重复全量门禁或追加提交main。

## 陈的三条日常待办

[逐条裁决](../../evidence/all-scene-audit/chen-daily3-adjudication.json)：夜市中文同步为当前生成已有的鱼丸串，雨站中文伞型同步为透明伞，两条双引擎生成文本和尺寸不变；火锅夹菜后擦汗与画外同席朋友可兼容，保留原场景。未生成、查看或上传图片。蓝图重建、分片契约和差异检查通过，当前490条待判定；本轮未重复全量门禁或追加提交main。

## 三条轻微细节裁决与未确认设定

[三条记录](../../evidence/all-scene-audit/minor-detail3-adjudication.json)：优香冲线后擦汗和白天体育场灯光可兼容，原样保留；未花动作字段同步取书，一姬中文发长去掉与英文不一致的具体长度，生成文本及尺寸均未改变。雪地白裙作为创作变体保留，不宣称原作事件或现实穿衣建议。飞鸟马时编号的官方域名文字检索未获得直接证据，保持未确认、未改数据；澄闪和莱万汀本轮读取的其他记录仍待判定。蓝图重建、分片契约及差异检查通过；当前487条待判定，无新出图、看图或上传，未重复全量门禁或追加提交main。

## 结衣三条文案同步

[三条前后记录](../../evidence/all-scene-audit/yui-text3-adjudication.json)：遛狗不再断言缺乏本次直接依据的具体犬种，保留原狗名；网球中文同步既有擦汗休息画面及团子发髻；甜品店中文同步现有草莓奶油可丽饼。双引擎生成文本和尺寸逐项不变，未重出图。侍奉部和祭典称呼未获直接官方文字证据，仍待判定，未据搜索中的二手材料改称呼；厨房时间/动作差异保留待办。当前484条待判定，未重复全量门禁或追加提交main。

## 结衣剩余三条文案闭环

[三条证据](../../evidence/all-scene-audit/yui-final3-adjudication.json)：厨房中文、时间和镜头字段同步到现有清晨端曲奇画面；侍奉部与祭典对话将自力酱统一为小企。[二手词条](https://zh.wikipedia.org/wiki/比企谷八幡)列有结衣使用ヒッキー及不同中文译法，本次采用网络常见译法，不冒充已核实官方唯一译名。持茶与递茶可兼容，一手团扇也不排除另一手牵手，不要求额外改写。三条双引擎生成文本及尺寸均未变化，无新出图、看图或上传。蓝图重建、分片契约与差异检查通过；当前481条待判定，未重复全量门禁或追加提交main。

## 更正黑川茜的旧裁决

[三个当前编译探针](../../evidence/all-scene-audit/akane-current-eye-probes.json)确认日常学校/咖啡店/书店均无条件接收身份词star_eyes。此前书店裁决仅依据identityProse中的表演条件，未验证实际身份词，因此该条重新进入待判定。此发现只说明生成输入，不证明实际图片或原作眼睛状态错误；尚不据此改共享角色数据或NSFW。眼镜与书店主题本身仍一致。当前待判定从481更正为482，不为保持数字下降而保留不足的通过结论。无新出图、看图、上传或源码修改；本轮未执行全量门禁或提交main。

## 黑川茜咖啡店局部文案修正

[局部前后记录](../../evidence/all-scene-audit/akane-cafe-partial-change.json)仅把中文咖啡/拿铁对谈同步为原生成已有的冰茶与角色分析笔记，保留原星瞳描述及共享身份数据。双引擎生成文本、负向和尺寸不变，未出图。三条星瞳编译探针已按当前源刷新；没有新增关闭记录，仍为482条待判定。眼睛状态待核这一限制未被文案修正掩盖。蓝图重建、分片契约和差异检查通过，本轮未执行全量门禁或提交main。

## 莉音三条日常裁决

[楼顶与冬日步道](../../evidence/all-scene-audit/rio-text2-adjudication.json)：楼顶大衣动作与暮夜时刻可兼容，保留；冬日中文同步为公园步道傍晚，双引擎生成内容和尺寸不变。地下档案馆[光源修正](../../evidence/all-scene-audit/rio-archive1-change.json)采用原英文已有的嵌入式顶灯，实际推导从window转为null，删除错误窗光附加而保留英文顶灯；[一张MiaoMiao候选](../../evidence/all-scene-audit/rio-archive1-human-review-queue.json)生成和参数核对成功。35项热门契约与286条当前候选对账通过，无看图或上传；当前479条待判定，未执行本轮全量门禁或追加提交main。

## 两条手部与工具表述修复

[雅儿贝德](../../evidence/all-scene-audit/albedo-ink1-adjudication.json)只把羽毛笔研磨墨水改为蘸墨处理公文，双引擎生成文本和尺寸不变。优香经核对衣装内置计算器后，[统一为一手叉腰、另一手托平板和账单](../../evidence/all-scene-audit/yuuka-budget1-change.json)，保留原衣装；[编译指令](../../evidence/all-scene-audit/yuuka-budget1-compiled.json)已核对，[一张MiaoMiao候选](../../evidence/all-scene-audit/yuuka-budget1-human-review-queue.json)生成和参数对账成功，未检查实际手部画面。35项热门契约及287条当前候选对账通过；当前477条待判定，无看图或上传，未执行本轮全量门禁或追加提交main。

## 未花花卉与雨景两条

[雨景文案](../../evidence/all-scene-audit/mika-rain1-adjudication.json)同步为已有雨中漫步及蕾丝洋伞，生成文本和尺寸不变；[休息室花种](../../evidence/all-scene-audit/mika-flowers1-change.json)将英文百合改为中文及正向标签已有的白蔷薇，并统一动作字段，保留稳定ID。[一张MiaoMiao候选](../../evidence/all-scene-audit/mika-flowers1-human-review-queue.json)生成并完成参数对账，未看图或上传。35项热门契约及288条当前候选对账通过；当前475条待判定，未执行本轮全量门禁或追加提交main。

## 希耶尔三条日常裁决

[三条记录](../../evidence/all-scene-audit/ciel-daily3-adjudication.json)：奉茶后推眼镜为顺序动作，查古旧参考书时指尖相触可保留画外同伴手，两条不强制改写。冬日公园只将动作字段双手伸袋改为正文及英文已有的一只手，双引擎生成文本及尺寸不变；风衣与围巾由既有场景补充，不新增重复衣装。既有眼镜负向冲突已在编译探针排除，学校版本不冒充新完成官方认证。蓝图重建、分片契约与差异检查通过；当前472条待判定，无新出图、看图或上传，未执行本轮全量门禁或追加提交main。

## 茉子、幸与一姬三条裁决

[茉子与幸](../../evidence/all-scene-audit/mako-sachi2-adjudication.json)的猫嘴表情、双侧束发小辫与动作可兼容，原样保留。一姬[文案修正](../../evidence/all-scene-audit/kazuki-cliff1-adjudication.json)去掉把雄二当作事故在场者的称呼，并移除与现有长发描述不一致的具体长度。[官方第11话](https://www.grisaia-anime.com/kajitsu/story/11.html)描述一姬带领部员与天音结识，[第13话](https://www.grisaia-anime.com/kajitsu/story/13.html)描述雄二听完回忆后前往现场。修正依据此时间关系，不宣称当前服装复刻原作。双引擎生成文本及尺寸不变，无出图、看图或上传；蓝图重建、分片契约和差异检查通过，当前469条待判定，未重复全量门禁或提交main。

## 用户暂停审计并要求发布新版本

本轮止于[澄闪两条衣装修复](../../evidence/all-scene-audit/goldenglow-outfit2-changes.json)，[两张最终候选](../../evidence/all-scene-audit/goldenglow-outfit2-human-review-queue.json)已生成并对账；花房继续使用原花房衣装，露台使用去环境描述的变体。当前290条候选未看图、未上传，等待用户人工验收；467条本任务SFW记录仍待判定，新49源证据对账也保留未完成状态。按用户指示停止后续审计，将当前检查点合入main并发布版本，不能把本次发布表述成全场景审核完成。

发布整合已基于最新main完成，[整合记录](../../evidence/all-scene-audit/release-reconciliation.json)确认761条既有成人源记录未被本轮改动覆盖；[发布前全量门禁](../../evidence/all-scene-audit/release-1.5.10-gate.txt)通过1m58s。桌面程序ProductVersion为1.5.10，安装器自检与updater签名验证通过。审计保持暂停，不将此次发布视为未完成场景的视觉验收。

独立发布副本再次通过[全量门禁](../../evidence/all-scene-audit/release-snapshot-gate.txt)，耗时1m53s；发布仅包含当前检查点和已合入main的更新。
