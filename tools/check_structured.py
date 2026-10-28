"""Check filled template slots: every response covered, every slot present, common grammar risks.

usage: python check_structured.py <app/data dir> [batch.json ...]
"""
import glob, json, os, re, sys

sys.path.insert(0, os.path.dirname(__file__))
from structured_template import SLOTS, assemble  # noqa: E402

data_dir = sys.argv[1]
files = sys.argv[2:] or sorted(glob.glob(os.path.join(os.path.dirname(__file__), "structured", "*.json")))
INFINITIVE = {"c1", "r1", "act", "c2", "r2", "neg"}
NOUN = {"pos", "s1", "d1", "arg2", "s2", "x1", "x2"}
CLAUSE = {"a", "b", "fin"}

all_ids = set()
for f in glob.glob(os.path.join(data_dir, "questions-*.json")):
    for q in json.load(open(f, encoding="utf-8"))["questions"]:
        all_ids.update(r["src"] for r in q["responses"])

seen, problems = set(), []
for f in files:
    for rid, slots in json.load(open(f, encoding="utf-8")).items():
        seen.add(rid)
        if rid not in all_ids:
            problems.append(f"{rid}: unknown response id")
        missing = [s for s in SLOTS if s != "ben" and not slots.get(s)]
        extra = [s for s in slots if s not in SLOTS]
        if missing or extra:
            problems.append(f"{rid}: missing {missing} extra {extra}")
            continue
        for k, v in slots.items():
            if v != v.strip() or v.endswith("."):
                problems.append(f"{rid}.{k}: stray space or final period")
            if v[:1].isupper() and not re.match(r"^(Internet|[A-Z]{2,}|[A-ZÉ][a-zé]+ [A-Z])", v):
                problems.append(f"{rid}.{k}: starts with a capital: {v[:40]}")
            if k in INFINITIVE and re.match(r"^(les?|la|l’)\s", v):
                problems.append(f"{rid}.{k}: infinitive slot starts with an article/pronoun: {v[:40]}")
        if not slots.get("ben", "peut").startswith(("peut", "peuvent")):
            problems.append(f"{rid}.ben: should start with 'peut'")
        try:
            assemble(slots)
        except Exception as e:  # noqa: BLE001
            problems.append(f"{rid}: {e}")

dups = json.load(open(os.path.join(os.path.dirname(__file__), "structured_duplicates.json"), encoding="utf-8"))
covered = seen | {d for d, orig in dups.items() if orig in seen}
print(f"{len(covered)} / {len(all_ids)} responses covered ({len(seen)} filled, {len(covered) - len(seen)} exact copies)")
print("\n".join(problems) if problems else "no problems")
