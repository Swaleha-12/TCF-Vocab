"""Extract lines with left/right x-position and font size, write as JSON lines."""
import sys, json, pypdfium2 as pdfium
import pypdfium2.raw as raw

f, out = sys.argv[1], sys.argv[2]
tp = pdfium.PdfDocument(f)[0].get_textpage()
n = tp.count_chars()
SKIP = ""
lines, cur, x0, x1, size = [], [], None, None, None
def push():
    if cur and x0 is not None:
        lines.append({"x": round(x0, 1), "r": round(x1, 1), "s": round(size, 1), "t": "".join(cur)})
for i in range(n):
    c = chr(raw.FPDFText_GetUnicode(tp, i))
    if c in "\n\r":
        push()
        cur, x0 = [], None
        continue
    if c == SKIP:
        continue
    if not c.isspace():
        l, b, r, t = tp.get_charbox(i)
        if x0 is None:
            x0, size = l, raw.FPDFText_GetFontSize(tp, i)
        x1 = r
    cur.append(c)
push()
with open(out, "w", encoding="utf-8") as fh:
    for l in lines:
        if l["t"].strip():
            fh.write(json.dumps(l, ensure_ascii=False) + "\n")
