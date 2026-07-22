"""Build a self-contained gallery and contact sheets from accepted scene audits."""

from __future__ import annotations

import argparse
import json
import math
import textwrap
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


PROJECT_ROOT = Path(__file__).resolve().parents[1]
AI_ROOT = PROJECT_ROOT.parent / "AI"
DEFAULT_AUDIT = AI_ROOT / "SceneAudits" / "2026-07-22_v14_final"
DEFAULT_OUTPUT = AI_ROOT / "SceneShowcase" / "2026-07-22_v14"
RATING_ORDER = ["All", "R15", "R18"]
RATING_LABELS = {"All": "全年龄", "R15": "R15", "R18": "R18"}
CHARACTER_LABELS = {"nene": "绫地宁宁", "natsume": "四季夏目", "triad": "宁宁 × 夏目"}


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"),
        Path("C:/Windows/Fonts/simhei.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def crop_cover(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(source.convert("RGB"), size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.35))


def save_jpeg(source: Image.Image, target: Path, max_size: tuple[int, int], quality: int) -> None:
    image = source.convert("RGB")
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=0)


def build_sheet(entries: list[dict], target: Path, heading: str, page: int, pages: int) -> None:
    columns, rows = 3, 4
    cell_width, image_height, caption_height = 500, 560, 138
    header_height = 96
    canvas = Image.new("RGB", (columns * cell_width, header_height + rows * (image_height + caption_height)), "#f7f3ee")
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(31, bold=True)
    meta_font = load_font(19)
    card_title_font = load_font(22, bold=True)
    body_font = load_font(16)
    draw.text((28, 20), heading, fill="#27222d", font=title_font)
    draw.text((28, 59), f"最终合格样张 · 第 {page}/{pages} 页 · 每张均经过直接视觉复核", fill="#716877", font=meta_font)

    for index, entry in enumerate(entries):
        col, row = index % columns, index // columns
        x = col * cell_width
        y = header_height + row * (image_height + caption_height)
        source = Image.open(entry["source"]).convert("RGB")
        preview = crop_cover(source, (cell_width, image_height))
        canvas.paste(preview, (x, y))
        rating = entry["rating"]
        accent = {"All": "#77a18d", "R15": "#bf9056", "R18": "#b65f70"}[rating]
        draw.rectangle((x, y, x + 8, y + image_height + caption_height), fill=accent)
        draw.rectangle((x + 8, y + image_height, x + cell_width, y + image_height + caption_height), fill="#fffdfb")
        label = f"{entry['id']}  {entry['title']}"
        draw.text((x + 20, y + image_height + 12), label[:34], fill="#25212b", font=card_title_font)
        meta = f"{CHARACTER_LABELS[entry['char']]} · {RATING_LABELS[rating]} · {entry['category']} · 最终第 {entry['attempt']} 次"
        draw.text((x + 20, y + image_height + 45), meta[:48], fill="#756c7a", font=body_font)
        story = entry["story"].split("】", 1)[-1]
        wrapped = textwrap.wrap(story, width=37)[:2]
        draw.multiline_text((x + 20, y + image_height + 73), "\n".join(wrapped), fill="#4b4550", font=body_font, spacing=4)

    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, "JPEG", quality=90, optimize=True, progressive=True, subsampling=0)


def build_cover(entries: list[dict], curated_ids: list[str], target: Path) -> None:
    entry_map = {entry["id"]: entry for entry in entries if entry["rating"] != "R18"}
    selected = [entry_map[scene_id] for scene_id in curated_ids if scene_id in entry_map][:12]
    if len(selected) < 12:
        selected.extend(entry for entry in entries if entry["rating"] != "R18" and entry not in selected)
        selected = selected[:12]
    width, height = 1800, 2400
    canvas = Image.new("RGB", (width, height), "#f7f3ee")
    draw = ImageDraw.Draw(canvas)
    draw.text((72, 68), "AI CG Studio · 场景效果总览", fill="#241f29", font=load_font(52, bold=True))
    draw.text((74, 137), "259 个场景 · 259 张最终合格样张 · 宁宁 / 夏目 v14", fill="#766d7a", font=load_font(27))
    card_w, card_h = 420, 500
    start_y = 220
    for index, entry in enumerate(selected):
        col, row = index % 4, index // 4
        x, y = 60 + col * 440, start_y + row * 650
        source = Image.open(entry["source"]).convert("RGB")
        canvas.paste(crop_cover(source, (card_w, card_h)), (x, y))
        draw.rounded_rectangle((x, y + card_h - 54, x + card_w, y + card_h), radius=0, fill="#fffdfbe8")
        draw.text((x + 14, y + card_h - 43), f"{entry['id']} · {entry['title'][:18]}", fill="#302a34", font=load_font(19, bold=True))
        draw.text((x, y + card_h + 16), f"{CHARACTER_LABELS[entry['char']]} · {RATING_LABELS[entry['rating']]}", fill="#746b78", font=load_font(17))
    draw.text((72, height - 108), "完整内容见 index.html；R18 默认隐藏，可在页面内主动开启。", fill="#776e7b", font=load_font(24))
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, "JPEG", quality=92, optimize=True, progressive=True, subsampling=0)


def build_html(entries: list[dict], output: Path) -> None:
    data = []
    for entry in entries:
        item = {key: entry[key] for key in ["id", "title", "category", "story", "char", "rating", "attempt"]}
        item["characterLabel"] = CHARACTER_LABELS[entry["char"]]
        item["ratingLabel"] = RATING_LABELS[entry["rating"]]
        item["image"] = f"images/{entry['id']}.jpg"
        item["thumb"] = f"thumbs/{entry['id']}.jpg"
        data.append(item)
    encoded = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    page = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI CG Studio · 259 场景效果展示</title>
<style>
:root{{--bg:#f4f0eb;--panel:rgba(255,255,255,.76);--ink:#27222d;--muted:#766d7a;--line:rgba(71,55,77,.12);--accent:#b8758b;--shadow:0 18px 50px rgba(52,37,58,.12)}}
*{{box-sizing:border-box}} body{{margin:0;background:radial-gradient(circle at 15% 0,#fff9f5,transparent 38%),var(--bg);color:var(--ink);font-family:"Microsoft YaHei UI","PingFang SC",sans-serif}}
header{{position:sticky;top:0;z-index:5;padding:22px clamp(18px,4vw,64px);background:rgba(247,243,238,.82);backdrop-filter:blur(22px);border-bottom:1px solid var(--line)}}
.top{{display:flex;gap:24px;align-items:end;justify-content:space-between;flex-wrap:wrap}} h1{{font-size:clamp(24px,4vw,42px);margin:0 0 6px}} .sub{{color:var(--muted)}}
.controls{{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}} input,button{{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:10px 15px;color:var(--ink);font:inherit}} input{{min-width:min(420px,90vw)}} button{{cursor:pointer}} button.active{{background:var(--ink);color:#fff}} button.adult{{border-color:#c68a98;color:#8d4358}}
main{{padding:28px clamp(16px,4vw,64px) 70px}} .count{{margin:0 0 18px;color:var(--muted)}} .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:20px}}
.card{{background:var(--panel);border:1px solid rgba(255,255,255,.8);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);transition:.2s transform}} .card:hover{{transform:translateY(-4px)}}
.art{{display:block;aspect-ratio:3/4;background:#e9e2df;overflow:hidden}} .art img{{width:100%;height:100%;object-fit:cover;object-position:50% 34%}}
.body{{padding:16px}} .meta{{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}} .tag{{font-size:12px;padding:5px 8px;border-radius:999px;background:#f2e8ec;color:#87546a}} h2{{font-size:17px;margin:0 0 10px}} p{{font-size:13px;line-height:1.7;color:#625a66;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}}
.empty{{padding:80px;text-align:center;color:var(--muted)}} footer{{padding:30px;text-align:center;color:var(--muted)}}
dialog{{border:0;border-radius:26px;padding:0;max-width:min(94vw,1100px);background:#17131a;color:#fff;box-shadow:0 30px 100px #0008}} dialog::backdrop{{background:#17131ad9;backdrop-filter:blur(8px)}} dialog img{{display:block;max-width:90vw;max-height:82vh}} .close{{position:absolute;right:14px;top:14px;background:#0009;color:#fff;border-color:#ffffff33}}
</style></head><body>
<header><div class="top"><div><h1>259 场景效果展示</h1><div class="sub">所有图片均来自对应场景的最终合格生成结果</div></div><div class="sub">宁宁 / 夏目 · v14 · 2026-07-22</div></div>
<div class="controls"><input id="q" placeholder="搜索标题、故事、分类或角色"><button data-char="all" class="active">全部角色</button><button data-char="nene">绫地宁宁</button><button data-char="natsume">四季夏目</button><button data-char="triad">双角色</button><button id="adult" class="adult">显示 R18</button></div></header>
<main><div class="count" id="count"></div><div class="grid" id="grid"></div></main><footer>AI CG Studio · 本地个人创作展示</footer>
<dialog id="viewer"><button id="closeViewer" class="close">关闭</button><img id="full" alt=""></dialog>
<script>const scenes={encoded};let character='all',adult=false;const grid=document.querySelector('#grid'),count=document.querySelector('#count'),q=document.querySelector('#q'),viewer=document.querySelector('#viewer'),full=document.querySelector('#full');
function esc(s){{return String(s).replace(/[&<>\"']/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}}[c]))}}
function render(){{const term=q.value.trim().toLowerCase();const list=scenes.filter(s=>(character==='all'||s.char===character)&&(adult||s.rating!=='R18')&&(!term||[s.id,s.title,s.story,s.category,s.characterLabel].join(' ').toLowerCase().includes(term)));count.textContent=`显示 ${{list.length}} / 259 个场景${{adult?' · 已显示 R18':' · R18 默认隐藏'}}`;grid.innerHTML=list.map(s=>`<article class="card"><a class="art" href="${{s.image}}" data-full="${{s.image}}"><img loading="lazy" src="${{s.thumb}}" alt="${{esc(s.title)}}"></a><div class="body"><div class="meta"><span class="tag">${{esc(s.id)}}</span><span class="tag">${{esc(s.characterLabel)}}</span><span class="tag">${{esc(s.ratingLabel)}}</span><span class="tag">第 ${{s.attempt}} 次通过</span></div><h2>${{esc(s.title)}}</h2><p>${{esc(s.story)}}</p></div></article>`).join('')||'<div class="empty">没有找到匹配场景</div>';document.querySelectorAll('[data-full]').forEach(a=>a.onclick=e=>{{e.preventDefault();full.src=a.dataset.full;viewer.showModal()}})}}
q.oninput=render;document.querySelectorAll('[data-char]').forEach(b=>b.onclick=()=>{{document.querySelectorAll('[data-char]').forEach(x=>x.classList.remove('active'));b.classList.add('active');character=b.dataset.char;render()}});document.querySelector('#adult').onclick=e=>{{adult=!adult;e.currentTarget.classList.toggle('active',adult);e.currentTarget.textContent=adult?'隐藏 R18':'显示 R18';render()}};document.querySelector('#closeViewer').onclick=()=>viewer.close();render();</script></body></html>"""
    (output / "index.html").write_text(page, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, default=DEFAULT_AUDIT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--scenes", type=Path, default=PROJECT_ROOT / "data" / "scenes.json")
    parser.add_argument("--curation", type=Path, default=PROJECT_ROOT / "data" / "curation.json")
    args = parser.parse_args()

    if args.output.exists():
        raise SystemExit(f"output already exists; choose a clean directory: {args.output}")
    scenes = {item["id"]: item for item in json.loads(args.scenes.read_text(encoding="utf-8"))}
    review = json.loads((args.audit / "manual-review.json").read_text(encoding="utf-8"))["records"]
    if len(review) != 259 or any(item.get("verdict") != "pass" for item in review.values()):
        raise SystemExit("manual review must contain exactly 259 passing scenes")

    entries = []
    for scene_id in sorted(review):
        scene = scenes[scene_id]
        attempt = int(review[scene_id]["attempt"])
        source = args.audit / "images" / scene_id / f"attempt-{attempt}.png"
        if not source.exists():
            raise SystemExit(f"missing approved source: {source}")
        entries.append({
            "id": scene_id,
            "title": scene["title"],
            "category": scene["category"],
            "story": scene["story"],
            "char": scene["char"],
            "rating": scene["rating"],
            "attempt": attempt,
            "source": source,
        })

    args.output.mkdir(parents=True)
    for index, entry in enumerate(entries, start=1):
        with Image.open(entry["source"]) as source:
            save_jpeg(source, args.output / "images" / f"{entry['id']}.jpg", (1400, 1800), 93)
            save_jpeg(source, args.output / "thumbs" / f"{entry['id']}.jpg", (420, 560), 84)
        if index % 50 == 0:
            print(f"processed {index}/{len(entries)}", flush=True)

    sheet_manifest = []
    for rating in RATING_ORDER:
        group = [entry for entry in entries if entry["rating"] == rating]
        pages = math.ceil(len(group) / 12)
        folder = f"{RATING_ORDER.index(rating) + 1:02d}-{rating.lower()}"
        for page_index in range(pages):
            batch = group[page_index * 12:(page_index + 1) * 12]
            first, last = batch[0]["id"], batch[-1]["id"]
            name = f"{page_index + 1:02d}_{first}-{last}.jpg"
            relative = Path("sheets") / folder / name
            build_sheet(batch, args.output / relative, f"{RATING_LABELS[rating]}场景", page_index + 1, pages)
            sheet_manifest.append({"rating": rating, "page": page_index + 1, "path": relative.as_posix(), "sceneIds": [item["id"] for item in batch]})

    curation = json.loads(args.curation.read_text(encoding="utf-8"))
    build_cover(entries, curation.get("curatedSceneIds", []), args.output / "00-cover.jpg")
    build_html(entries, args.output)
    manifest_entries = []
    for entry in entries:
        item = {key: entry[key] for key in ["id", "title", "category", "story", "char", "rating", "attempt"]}
        item["image"] = f"images/{entry['id']}.jpg"
        item["thumb"] = f"thumbs/{entry['id']}.jpg"
        manifest_entries.append(item)
    manifest = {
        "version": 1,
        "sourceAudit": args.audit.name,
        "sceneCount": len(entries),
        "counts": dict(Counter(entry["rating"] for entry in entries)),
        "entries": manifest_entries,
        "sheets": sheet_manifest,
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.output / "README.txt").write_text(
        "AI CG Studio 场景效果展示\n\n"
        "1. 双击 index.html：搜索、筛选并查看 259 个最终合格场景。\n"
        "2. 00-cover.jpg：适合快速介绍。\n"
        "3. sheets：按全年龄、R15、R18 分开的分页对比图。\n"
        "4. images：最终合格大图；thumbs：网页缩略图。\n\n"
        "R18 内容在网页中默认隐藏，需要主动点击“显示 R18”。\n",
        encoding="utf-8",
    )
    total_bytes = sum(path.stat().st_size for path in args.output.rglob("*") if path.is_file())
    print(json.dumps({"output": str(args.output), "scenes": len(entries), "sheets": len(sheet_manifest), "megabytes": round(total_bytes / 1024 / 1024, 2)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
