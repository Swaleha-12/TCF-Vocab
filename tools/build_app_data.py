"""Build the app's data files.

Groups repeated questions, links each flashcard example to its response, and marks
where every vocabulary entry appears inside the sample responses so the app can
highlight it.

usage: python build_app_data.py <work_dir with parsed/> <vocab.json> <out_dir>
"""
import json, os, re, sys, unicodedata
import spacy

work, vocab_path, out_dir = sys.argv[1:4]
CATS = ["culture", "economie", "technologie", "sante", "famille", "education"]
POS = {"N": "NOUN", "V": "VERB", "A": "ADJ", "ADV": "ADV"}
SEP = "’-"

nlp = spacy.load("fr_core_news_md", disable=["ner"])
vocab = json.load(open(vocab_path, encoding="utf-8"))
by_cat = {c["slug"]: c for c in vocab["categories"]}


def qkey(q):
    q = unicodedata.normalize("NFKD", q.lower())
    q = "".join(ch for ch in q if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", q).strip()


def base_lemma(fr):
    w = re.sub(r"^(se |s’)", "", fr)
    return re.sub(r" (à|de|contre|sur)$", "", w).lower()


def compile_rx(rx):
    # anchors in the list mean "start of a sentence"; inside a paragraph that is also after . ! ?
    rx = rx.replace("^", r"(?:^|(?<=[.!?] ))")
    return re.compile(rx, re.I)


def expand(text, a, b):
    while a > 0 and text[a - 1].isalpha():
        a -= 1
    while b < len(text) and (text[b].isalpha() or text[b] == "-"):
        b += 1
    return a, b


def mark_paragraph(doc, text, lemma_map, rx_list):
    spans = []
    for t in doc:
        vid = lemma_map.get((t.pos_, t.lemma_.lower()))
        if vid:
            spans.append((t.idx, t.idx + len(t.text), vid))
    for vid, r, is_exp in rx_list:
        for m in r.finditer(text):
            a, b = (m.start(), m.end()) if is_exp else expand(text, m.start(), m.end())
            while b > a and text[b - 1] in ",;: ":
                b -= 1
            if b > a:
                spans.append((a, b, vid))
    # keep longest non-overlapping spans
    spans.sort(key=lambda s: (s[0], -(s[1] - s[0])))
    out, end = [], -1
    for a, b, vid in spans:
        if a >= end:
            out.append([a, b, vid])
            end = b
    return out


arg_rx = [(w["id"], compile_rx(w["rx"]), True) for w in by_cat["argumentation"]["words"] if w.get("rx")]
os.makedirs(out_dir, exist_ok=True)
source_map = {}
summary = {}

for c in CATS:
    items = json.load(open(os.path.join(work, "parsed", c + ".json"), encoding="utf-8"))["items"]
    words = by_cat[c]["words"]
    lemma_map, rx_list = {}, []
    for w in words:
        if w.get("rx"):
            rx_list.append((w["id"], compile_rx(w["rx"]), w["type"] == "EXP"))
        elif w["type"] in POS:
            lemma_map.setdefault((POS[w["type"]], base_lemma(w["fr"])), w["id"])
        else:
            rx_list.append((w["id"], re.compile(re.escape(w["fr"]), re.I), True))
    rx_list += arg_rx

    groups, order = {}, []
    for it in items:
        k = qkey(it["question"])
        if k not in groups:
            groups[k] = {"id": f"{c}-q{len(order) + 1:03d}", "q": it["question"].strip(), "responses": []}
            order.append(k)
        g = groups[k]
        paras = []
        for text, doc in zip(it["response"], nlp.pipe(it["response"])):
            paras.append({"t": text, "m": mark_paragraph(doc, text, lemma_map, rx_list)})
        source_map[it["id"]] = (g["id"], len(g["responses"]))
        g["responses"].append({"src": it["id"], "p": paras})

    questions = [groups[k] for k in order]
    json.dump({"slug": c, "questions": questions},
              open(os.path.join(out_dir, f"questions-{c}.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    summary[c] = {"questions": len(questions), "responses": sum(len(q["responses"]) for q in questions)}
    print(c, summary[c], flush=True)

for cat in vocab["categories"]:
    for w in cat["words"]:
        w.pop("rx", None)
        if w.get("source") in source_map:
            w["qid"], w["ri"] = source_map[w["source"]]
        w.pop("source", None)
    if cat["slug"] in summary:
        cat.update(summary[cat["slug"]])
json.dump(vocab, open(os.path.join(out_dir, "vocab.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
