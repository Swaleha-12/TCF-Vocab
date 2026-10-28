"""The structured Tâche 3 answer template, and how a response's filled-in slots are assembled into it.

Each response has a dict of slots (written in tools/structured/*.json). The fixed sentences
below come from the user's template; slot text is inserted where the template had a [BLANK].
"""
import re

APOS = "’"

# Each section: heading, then a list of pieces. A piece is fixed text or a (joiner, slot) pair.
# The joiner is the word just before the blank, so contractions can be applied (à + le -> au).
TEMPLATE = [
    ("Introduction", [
        "C’est une question qui mérite qu’on y réfléchisse, car elle suscite des opinions assez différentes. "
        "En effet, certaines personnes pensent ", ("que", "a"), ", tandis que d’autres considèrent ", ("que", "b"),
        ". Pour ma part, je suis plutôt favorable ", ("à", "pos"),
        ", et je vais vous expliquer les principales raisons qui me poussent à adopter ce point de vue.",
    ]),
    ("Argument 1", [
        "Tout d’abord, je pense que cette situation peut être particulièrement bénéfique pour les personnes concernées. "
        "En effet, ", ("", "s1"), " ", ("", "ben"), ". Cela permet notamment ", ("de", "c1"),
        ". À titre d’exemple, prenons le cas d’une personne ", ("qui", "e1"),
        ". Grâce à cette situation, elle peut ", ("", "r1"),
        ". Cet exemple montre donc que cette pratique peut avoir des effets positifs ", ("sur", "d1"), ".",
    ]),
    ("Argument 2", [
        "De plus, un autre aspect important concerne ", ("", "arg2"), ". À mon avis, ", ("", "s2"),
        " permet aux personnes ", ("de", "act"), ". Grâce à cela, elles peuvent ", ("", "c2"),
        ". Pour illustrer ce point, prenons l’exemple d’une personne ", ("qui", "e2"),
        ". Cette expérience lui permet ", ("de", "r2"),
        ". Ainsi, on peut constater que cette pratique contribue non seulement ", ("à", "x1"),
        ", mais aussi ", ("à", "x2"), ".",
    ]),
    ("Contre-argument", [
        "Cependant, il faut également reconnaître que cette situation peut avoir des effets négatifs et présenter "
        "certaines limites. Il est vrai que cela peut être difficile pour certaines personnes, que cela demande du "
        "temps et des efforts, ou encore que cela peut entraîner certaines difficultés. À titre d’exemple, prenons le "
        "cas d’une personne ", ("qui", "pb"), ". Dans cette situation, elle peut ", ("", "neg"),
        ". Néanmoins, je pense que ces inconvénients doivent être nuancés. Selon moi, les avantages restent plus "
        "importants, notamment parce que cette situation peut avoir des effets positifs à long terme.",
    ]),
    ("Conclusion", [
        "Pour conclure, même s’il serait réducteur de nier l’existence de certaines limites ou de certaines "
        "difficultés, je reste néanmoins convaincue que les avantages l’emportent largement sur les inconvénients. "
        "À mon sens, ce qui est particulièrement important, c’est de trouver un juste équilibre et d’adopter une "
        "approche raisonnable. Dans l’ensemble, je pense ", ("que", "fin"), ".",
    ]),
]

SLOTS = ["a", "b", "pos", "s1", "ben", "c1", "e1", "r1", "d1", "arg2", "s2", "act", "c2", "e2", "r2",
         "x1", "x2", "pb", "neg", "fin"]
DEFAULTS = {"ben": "peut contribuer au bien-être des personnes tout en permettant d’améliorer leur qualité de vie"}

VOWEL = re.compile(r"^[aeiouyhâàéèêëîïôœûù]", re.I)
H_ASPIRE = ("haut", "hasard", "honte", "héros", "hiérarch", "handicap", "hausse", "hors")


def _elides(word):
    w = word.lower()
    return bool(VOWEL.match(w)) and not (w.startswith("h") and w.startswith(H_ASPIRE))


def join(joiner, text):
    """Return the text of joiner + slot, applying French contractions. The slot text keeps its own case."""
    text = text.strip().rstrip(".")
    if not joiner:
        return text
    first = text.split(" ", 1)[0]
    rest = text[len(first):]
    low = first.lower()
    if joiner == "à":
        if low == "le":
            return "au" + rest
        if low == "les":
            return "aux" + rest
        return "à " + text
    if joiner == "de":
        if low == "le":
            return "du" + rest
        if low == "les":
            return "des" + rest
        if _elides(first):
            return "d" + APOS + text
        return "de " + text
    if joiner == "que":
        if low in ("il", "ils", "elle", "elles", "on", "un", "une", "en", "à", "au", "aux") or _elides(first):
            return "qu" + APOS + text
        return "que " + text
    if joiner == "sur":
        return "sur " + text
    return joiner + " " + text


def assemble(slots):
    """Return [{"h": heading, "t": text, "f": [[start, end], ...]}] where f marks the filled-in parts."""
    out = []
    for heading, pieces in TEMPLATE:
        text, fills = "", []
        for piece in pieces:
            if isinstance(piece, str):
                text += piece
                continue
            joiner, key = piece
            value = (slots.get(key) or DEFAULTS.get(key) or "").strip()
            if not value:
                raise ValueError(f"missing slot {key}")
            joined = join(joiner, value)
            if joiner and joined.startswith(joiner + " "):
                start = len(text) + len(joiner) + 1
            elif joiner and APOS in joined[:3]:
                start = len(text) + joined.index(APOS) + 1
            else:
                start = len(text)  # no joiner, or a contraction (au, aux, du, des) that belongs to the fill
            text += joined
            fills.append([start, len(text)])
        out.append({"h": heading, "t": text, "f": fills})
    return out

