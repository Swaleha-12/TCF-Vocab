"""Print compact digests of sample responses (question, intro, topic sentences) in batches,
used as input for filling the structured template by hand.

usage: python digest_responses.py <app/data dir> <out dir> [batch size]
"""
import json, os, re, sys

data_dir, out_dir = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 12
CATS = ["culture", "economie", "technologie", "sante", "famille", "education"]
os.makedirs(out_dir, exist_ok=True)


def sentences(p):
    return re.split(r"(?<=[.!?])\s+(?=[A-ZÀÂÉÈÊÎÔÛÇ«])", p)


def clip(s, n=260):
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


here = os.path.dirname(os.path.abspath(__file__))
skip = set(json.load(open(os.path.join(here, "structured_duplicates.json"), encoding="utf-8")))
for f in __import__("glob").glob(os.path.join(here, "structured", "*.json")):
    skip.update(json.load(open(f, encoding="utf-8")))
items = []
for c in CATS:
    for q in json.load(open(os.path.join(data_dir, f"questions-{c}.json"), encoding="utf-8"))["questions"]:
        for r in q["responses"]:
            if r["src"] in skip:
                continue
            paras = [p["t"] for p in r["p"]]
            lines = [f"### {r['src']}", f"Q: {q['q']}"]
            for i, p in enumerate(paras):
                ss = sentences(p)
                take = 3 if i == 0 else 2
                lines.append(f"P{i + 1}: " + clip(" ".join(ss[:take]), 420 if i == 0 else 300))
            items.append("\n".join(lines))

n = int(sys.argv[4]) if len(sys.argv) > 4 else 0
for i in range(0, len(items), size):
    n += 1
    with open(os.path.join(out_dir, f"batch-{n:03d}.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n\n".join(items[i:i + size]) + "\n")
print(len(items), "responses in", n, "batches")
