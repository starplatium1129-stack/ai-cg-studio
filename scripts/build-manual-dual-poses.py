"""Draw story-specific two-person OpenPose maps for the published dual scenes."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "assets" / "dual-poses"
SIZE = (1344, 896)

# OpenPose COCO body-18 limb order and colors.
LIMBS = [
    (1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7),
    (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13),
    (1, 0), (0, 14), (14, 16), (0, 15), (15, 17), (2, 16), (5, 17),
]
COLORS = [
    (255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0),
    (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85),
    (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255),
    (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255),
    (255, 0, 170), (255, 0, 85), (255, 128, 0),
]


def face(joints: dict[int, tuple[int, int]], nose: tuple[int, int], scale: float = 1.0) -> None:
    x, y = nose
    joints[0] = (x, y)
    joints[14] = (round(x - 15 * scale), round(y - 4 * scale))
    joints[15] = (round(x + 15 * scale), round(y - 4 * scale))
    joints[16] = (round(x - 34 * scale), round(y + 2 * scale))
    joints[17] = (round(x + 34 * scale), round(y + 2 * scale))


def standing(cx: int, head_y: int, scale: float = 1.0) -> dict[int, tuple[int, int]]:
    def p(dx: float, dy: float) -> tuple[int, int]:
        return round(cx + dx * scale), round(head_y + dy * scale)

    joints = {
        1: p(0, 72), 2: p(-58, 92), 3: p(-92, 190), 4: p(-112, 292),
        5: p(58, 92), 6: p(92, 190), 7: p(112, 292),
        8: p(-34, 310), 9: p(-42, 470), 10: p(-48, 635),
        11: p(34, 310), 12: p(42, 470), 13: p(48, 635),
    }
    face(joints, p(0, 0), scale)
    return joints


def draw_person(draw: ImageDraw.ImageDraw, joints: dict[int, tuple[int, int]]) -> None:
    for index, (start, end) in enumerate(LIMBS):
        if start in joints and end in joints:
            draw.line([joints[start], joints[end]], fill=COLORS[index], width=11)
    for index, point in joints.items():
        color = COLORS[index % len(COLORS)]
        x, y = point
        draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill=color)


def scene_poses() -> dict[str, list[dict[int, tuple[int, int]]]]:
    # sc028: both seated; Natsume reaches across to fix Nene's hair while the
    # promise card rests between their other hands.
    nene = standing(410, 145, 0.88)
    nene.update({8: (375, 520), 11: (445, 520), 9: (315, 610), 12: (520, 610), 10: (245, 790), 13: (595, 790), 6: (535, 410), 7: (650, 500)})
    natsume = standing(905, 145, 0.88)
    natsume.update({8: (870, 520), 11: (940, 520), 9: (810, 610), 12: (1015, 610), 10: (740, 790), 13: (1090, 790), 3: (700, 250), 4: (535, 215), 6: (805, 410), 7: (690, 500)})

    # sc031: ceremonial full-body pose; each woman offers a different hand to
    # the unseen viewer while their free hand stays near the heart.
    c31_nene = standing(400, 105, 0.95)
    c31_nene.update({3: (500, 400), 4: (610, 555), 6: (430, 300), 7: (445, 355)})
    c31_natsume = standing(940, 105, 0.95)
    c31_natsume.update({6: (835, 400), 7: (730, 555), 3: (910, 300), 4: (895, 355)})

    # sc144: Nene handles the floating tea on the left; Natsume leans over a
    # laptop on the right.
    c144_nene = standing(385, 155, 0.82)
    c144_nene.update({8: (355, 515), 11: (420, 515), 9: (320, 665), 12: (470, 665), 10: (290, 820), 13: (510, 820), 6: (500, 415), 7: (610, 500)})
    c144_natsume = standing(900, 135, 0.9)
    c144_natsume.update({1: (865, 235), 2: (805, 255), 5: (925, 270), 3: (875, 420), 4: (1010, 545), 6: (990, 420), 7: (1125, 555), 8: (850, 520), 11: (920, 525)})

    # sc151: both bodies lie along the bed from opposite sides of the frame.
    c151_nene = {1: (375, 390), 2: (350, 335), 3: (470, 420), 4: (600, 500), 5: (395, 445), 6: (500, 500), 7: (610, 530), 8: (585, 410), 9: (750, 370), 10: (900, 345), 11: (590, 470), 12: (755, 465), 13: (920, 460)}
    face(c151_nene, (285, 355), 0.9)
    c151_natsume = {1: (965, 350), 2: (940, 300), 3: (820, 355), 4: (720, 470), 5: (990, 405), 6: (875, 470), 7: (760, 515), 8: (760, 390), 9: (610, 340), 10: (470, 325), 11: (755, 450), 12: (610, 455), 13: (465, 470)}
    face(c151_natsume, (1050, 305), 0.9)

    # sc154: Nene faces the viewer at the center-left; Natsume leans in from
    # behind on the right. Both remain separate skeletons.
    c154_nene = standing(500, 135, 0.92)
    c154_nene.update({3: (530, 400), 4: (620, 520), 6: (590, 400), 7: (680, 520), 8: (455, 520), 11: (545, 520), 9: (350, 710), 10: (245, 860), 12: (660, 710), 13: (780, 860)})
    c154_natsume = standing(825, 155, 0.88)
    c154_natsume.update({1: (785, 245), 2: (725, 270), 5: (845, 280), 3: (650, 330), 4: (585, 270), 6: (760, 420), 7: (665, 500), 8: (770, 540), 11: (850, 535)})

    # sc157: both lean toward the unseen viewer from opposite sides; Nene's
    # hands meet the viewer at the center while Natsume reaches out of frame.
    c157_nene = standing(455, 150, 0.9)
    c157_nene.update({3: (525, 400), 4: (635, 500), 6: (560, 410), 7: (645, 525), 8: (425, 540), 11: (500, 540)})
    c157_natsume = standing(850, 150, 0.9)
    c157_natsume.update({1: (815, 245), 2: (750, 270), 5: (875, 280), 3: (695, 390), 4: (655, 505), 6: (960, 390), 7: (1085, 500), 8: (790, 545), 11: (875, 545)})

    return {
        "sc028": [nene, natsume],
        "sc031": [c31_nene, c31_natsume],
        "sc144": [c144_nene, c144_natsume],
        "sc151": [c151_nene, c151_natsume],
        "sc154": [c154_nene, c154_natsume],
        "sc157": [c157_nene, c157_natsume],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    poses = scene_poses()
    for scene_id, people in poses.items():
        image = Image.new("RGB", SIZE, "black")
        draw = ImageDraw.Draw(image)
        for person in people:
            draw_person(draw, person)
        image.save(args.output / f"{scene_id}.png", "PNG", optimize=True)
        print(f"{scene_id}: {len(people)} story-specific skeletons")
    manifest = {
        "version": 2,
        "module": "manual_openpose",
        "resolution": list(SIZE),
        "source": "scene story blueprints",
        "poses": {scene_id: f"{scene_id}.png" for scene_id in poses},
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
