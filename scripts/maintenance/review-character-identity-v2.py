"""Run the identity reviewer with clean, strict Chinese review instructions."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


SOURCE = Path(__file__).with_name("review-character-identity.py")
SPEC = importlib.util.spec_from_file_location("identity_reviewer", SOURCE)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load {SOURCE}")
reviewer = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = reviewer
SPEC.loader.exec_module(reviewer)

reviewer.SEVERE_ERROR_MARKERS = {
    "明显换脸", "完全换脸", "瞳色错误", "眼睛颜色错误", "关键装饰缺失", "完全缺失",
    "多余肢体", "肢体断裂", "严重畸形", "wrong eye color", "missing signature", "identity swap",
}


def strict_prompt(character: str, test: str) -> str:
    identity = (
        "绫地宁宁：柔和偏小的脸、紫色眼睛、银白色超长低双马尾、细碎刘海与呆毛、粉色发带。"
        "脸型、眼形与双马尾扎法必须像左侧官方图，不能只因白发紫瞳就判定相似。"
        if character == "nene"
        else "四季夏目：柔和偏瘦的小脸、金黄色眼睛、黑色长发与侧刘海、眼下泪痣、侧边发夹。"
        "脸型、眼神、泪痣位置和发夹均为硬特征，不能只因黑发黄瞳就判定相似。"
    )
    outfit = (
        "本张是服装测试，outfit_fidelity 必须逐件对照左侧官方全身参考。"
        if test in reviewer.OUTFIT_TESTS
        else "本张是脸部测试，outfit_fidelity 输出 null，不要让衣服影响身份评分。"
    )
    return (
        "你是非常严格的二次元角色 LoRA 盲测审核员。拼图最左侧是 OFFICIAL 官方参考，其余为匿名候选 A 到 E。"
        "逐个候选与官方图比较，不得根据位置猜版本，不得因画面精致就抬高角色相似度。"
        f"角色身份基准：{identity}{outfit}"
        "identity_face 重点比较脸型轮廓、额头/下巴比例、眼形眼距、眉眼关系、鼻口位置和官方气质；"
        "hair_structure 比较刘海分束、侧发、长度与扎法；signature_accessories 比较瞳色及泪痣、发夹、发带、呆毛等专属特征；"
        "anatomy 与 render_quality 独立评分。明显换脸、瞳色错误、发型结构错误、关键装饰缺失都必须写入 critical_errors。"
        "只输出 JSON，不要 Markdown 或解释。固定格式："
        '{"scores":{"A":{"identity_face":0,"hair_structure":0,"signature_accessories":0,'
        '"outfit_fidelity":null,"anatomy":0,"render_quality":0,"critical_errors":[]},'
        '"B":{},"C":{},"D":{},"E":{}},"ranking":["A","B","C","D","E"],'
        '"best":"A","reason":"一句中文结论"}。所有分数为 0 到 10，可用一位小数，五个候选都必须完整评分。'
    )


reviewer.prompt = strict_prompt

if __name__ == "__main__":
    reviewer.main()
