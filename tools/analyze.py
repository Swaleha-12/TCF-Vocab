"""POS-tag all responses; output per-category distinctive lemmas by POS, plus sentence index."""
import json, sys, os, math, collections, spacy

parsed, out = sys.argv[1], sys.argv[2]
nlp = spacy.load("fr_core_news_md", disable=["ner"])
CATS = ["culture", "economie", "technologie", "sante", "famille", "education"]
POS = {"NOUN", "VERB", "ADJ", "ADV"}
freq = {c: collections.Counter() for c in CATS}
docfreq = {c: collections.Counter() for c in CATS}
genders = collections.defaultdict(collections.Counter)
sentences = {}  # (cat, pos, lemma) -> list of (sentence, item id) up to 6

for c in CATS:
    data = json.load(open(os.path.join(parsed, c + ".json"), encoding="utf-8"))
    for it in data["items"]:
        seen = set()
        for doc in nlp.pipe(it["response"]):
            for sent in doc.sents:
                st = sent.text.strip()
                for t in sent:
                    if t.pos_ not in POS or not t.is_alpha or len(t.lemma_) < 3:
                        continue
                    key = (t.pos_, t.lemma_.lower())
                    freq[c][key] += 1
                    seen.add(key)
                    if t.pos_ == "NOUN":
                        g = t.morph.get("Gender")
                        if g: genders[key[1]][g[0]] += 1
                    lst = sentences.setdefault(f"{c}|{key[0]}|{key[1]}", [])
                    if len(lst) < 6 and 40 < len(st) < 220 and all(s[0] != st for s in lst):
                        lst.append([st, it["id"], t.text])
        for k in seen:
            docfreq[c][k] += 1
    print(c, "done", flush=True)

total = collections.Counter()
for c in CATS: total.update(freq[c])
N = sum(total.values())
result = {}
for c in CATS:
    nc = sum(freq[c].values())
    rows = []
    for k, f in freq[c].items():
        if docfreq[c][k] < 2: continue
        other = total[k] - f
        # smoothed log-ratio of in-category vs rest rate
        lr = math.log(((f + 1) / (nc + 1)) / ((other + 1) / (N - nc + 1)))
        rows.append({"pos": k[0], "lemma": k[1], "f": f, "df": docfreq[c][k], "lr": round(lr, 2)})
    result[c] = rows
json.dump({"result": result, "genders": {k: dict(v) for k, v in genders.items()}, "sentences": sentences},
          open(out, "w", encoding="utf-8"), ensure_ascii=False)
