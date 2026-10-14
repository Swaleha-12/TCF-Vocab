"""Combine curated word list with example sentences from the sample responses."""
import json, re, sys, os

S = sys.argv[1]  # work dir holding parsed/ and analysis.json
VOCAB_LIST = sys.argv[2]
OUT = sys.argv[3]
parsed = os.path.join(S, "parsed")
A = json.load(open(os.path.join(S, "analysis.json"), encoding="utf-8"))
CATS = ["culture", "economie", "technologie", "sante", "famille", "education"]
LABELS = {"culture": "Culture", "economie": "Économie", "technologie": "Technologie", "sante": "Santé",
          "famille": "Famille", "education": "Éducation", "argumentation": "Argumentation"}
POS = {"N": "NOUN", "V": "VERB", "A": "ADJ", "ADV": "ADV"}

sents = {}
for c in CATS:
    out = []
    for it in json.load(open(os.path.join(parsed, c + ".json"), encoding="utf-8"))["items"]:
        for p in it["response"]:
            for s in re.split(r"(?<=[.!?])\s+(?=[A-ZÀÂÉÈÊÎÔÛÇ])", p):
                out.append((s.strip(), it["id"]))
    sents[c] = out

def score(s):
    n = len(s)
    pen = 0 if 60 <= n <= 170 else 100 + abs(n - 115)
    if not s[:1].isupper(): pen += 500
    return pen + abs(n - 115) / 10

def by_regex(cats, rx):
    r = re.compile(rx, re.I)
    best = None
    for c in cats:
        for s, src in sents[c]:
            m = r.search(s)
            if m and (best is None or score(s) < score(best[0])):
                a, b = m.start(), m.end()
                while a > 0 and (s[a-1].isalpha() or s[a-1] in "’-") and not s[a-2:a] in ("s’", "d’", "l’", "n’", "m’", "t’", "j’", "c’", "S’", "D’", "L’", "N’", "C’", "J’", "qu’"[-2:]): a -= 1
                while b < len(s) and (s[b].isalpha() or s[b] == "-"): b += 1
                best = (s, src, s[a:b])
    return best

def by_lemma(cat, pos, lemma):
    lst = A["sentences"].get(f"{cat}|{pos}|{lemma}") or []
    if not lst:
        return None
    s, src, tok = min(lst, key=lambda x: score(x[0]))
    return (s, src, tok)

def base_lemma(fr):
    w = re.sub(r"^(se |s’)", "", fr)
    return re.sub(r" (à|de|contre|sur)$", "", w)

cats, cur, missing = {}, None, []
for line in open(VOCAB_LIST, encoding="utf-8"):
    line = line.rstrip("\n")
    if not line or line.startswith("#"):
        continue
    if line.startswith("@"):
        cur = line[1:]
        cats[cur] = []
        continue
    parts = line.split("|")
    typ, fr, gender, en = parts[:4]
    rest = "|".join(parts[4:])
    rx = rest[3:] if rest.startswith("re:") else None
    search_cats = CATS if cur == "argumentation" else [cur]
    ex = None
    if rx:
        ex = by_regex(search_cats, rx)
    elif typ in POS:
        ex = by_lemma(cur, POS[typ], base_lemma(fr).lower())
        if not ex:
            ex = by_regex(search_cats, r"\b" + re.escape(base_lemma(fr)[:max(4, len(base_lemma(fr)) - 2)]) + r"\w*")
    else:
        ex = by_regex(search_cats, re.escape(fr))
    if not ex:
        missing.append(f"{cur}: {fr}")
    entry = {"id": f"{cur}-{len(cats[cur]) + 1:03d}", "type": typ, "fr": fr, "en": en}
    if rx:
        entry["rx"] = rx
    if typ == "N":
        entry["gender"] = gender
        art = "l’" if re.match(r"^[aeiouyéèêâîôûœh]", fr, re.I) and fr not in ("héros",) else ("le " if gender == "m" else "la ")
        entry["display"] = art + fr + (f" ({gender}.)" if art == "l’" else "")
    else:
        entry["display"] = fr
    if ex:
        entry["example"], entry["source"], entry["highlight"] = ex
    cats[cur].append(entry)

json.dump({"categories": [{"slug": k, "label": LABELS[k], "words": v} for k, v in cats.items()]},
          open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in cats.items()}, "total", sum(len(v) for v in cats.values()))
print("missing examples:", missing)
