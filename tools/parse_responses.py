"""Turn positioned lines into {question, response[paragraphs]} items per category."""
import json, re, sys, os, glob

lines_dir, out_dir = sys.argv[1], sys.argv[2]
LABELS = {"culture": "Culture", "economie": "Économie", "technologie": "Technologie",
          "sante": "Santé", "famille": "Famille", "education": "Éducation"}

def norm(s):
    return re.sub(r"\s+", " ", s).strip()

for path in sorted(glob.glob(os.path.join(lines_dir, "*.jsonl"))):
    slug = os.path.basename(path)[:-6]
    L = [json.loads(l) for l in open(path, encoding="utf-8")][1:]  # drop page title
    body_size = max(set(l["s"] for l in L), key=lambda s: sum(1 for l in L if l["s"] == s))
    body_x = sorted(l["x"] for l in L if l["s"] == body_size)[len(L) // 2]
    max_r = sorted(l["r"] for l in L if l["s"] == body_size)[-50]
    if slug == "famille":
        is_q = lambda l: l["x"] < body_x - 30
    else:
        is_q = lambda l: l["s"] > body_size
    items, q, paras, cur = [], [], [], []
    prev = None
    def close_para():
        global cur
        if cur:
            paras.append(norm(" ".join(cur)))
        cur = []
    def flush():
        close_para()
        ps = [p for p in paras if p]
        # drop a question echoed at the top of the answer
        while ps and ps[0].endswith("?") and len(ps[0]) < 250:
            ps.pop(0)
        if q and ps and sum(len(p) for p in ps) > 400:
            items.append({"question": norm(" ".join(q)), "response": ps})
    for l in L:
        t = l["t"]
        if is_q(l):
            if paras or cur:
                flush()
                q, paras[:] = [], []
            q.append(t)
        else:
            if prev is not None and not is_q(prev) and re.search(r"[.!?:»]\s*$", prev["t"]) and prev["r"] < max_r - 25:
                close_para()
            cur.append(t)
        prev = l
    flush()
    # strip paragraphs copied verbatim from an earlier answer (source paste errors)
    seen_p = set()
    for it in items:
        fresh = [p for p in it["response"] if p[:150] not in seen_p]
        seen_p.update(p[:150] for p in it["response"])
        if len(fresh) >= 3:
            it["response"] = fresh
    seen_q, seen_r, uniq, dup_resp = set(), set(), [], 0
    for it in items:
        rk = it["response"][0][:120]
        qk = it["question"].lower()
        if (qk, rk) in seen_q:
            continue
        seen_q.add((qk, rk))
        if rk in seen_r:
            dup_resp += 1
            it["note"] = "response reused from an earlier question in the source"
        seen_r.add(rk)
        uniq.append(it)
    for i, it in enumerate(uniq):
        it["id"] = f"{slug}-{i+1:03d}"
    json.dump({"slug": slug, "label": LABELS[slug], "items": uniq},
              open(os.path.join(out_dir, slug + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{slug}: {len(items)} items, {len(uniq)} after exact-dup removal, {len({u['question'].lower() for u in uniq})} distinct questions, {dup_resp} reused responses")
