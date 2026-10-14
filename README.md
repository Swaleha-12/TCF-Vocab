# Vocabulaire Tâche 3

A study app for the TCF *Expression orale*, Tâche 3, organised by theme (Culture, Économie, Technologie, Santé, Famille, Éducation, plus an Argumentation deck of connectors).

- **Fiches:** 501 flashcards. Each card has the French word (with gender for nouns), the English translation and a real example sentence from a sample response. "À revoir" / "Je sais" drives a simple Leitner review, so the cards you miss come back more often.
- **Pratique Tâche 3:** about 630 real Tâche 3 questions with a 4:30 timer, optional hints, optional self-recording, and the sample response with the theme vocabulary and connectors highlighted. Tap a highlighted word to see its translation.
- **Liste:** every word of a theme, searchable, with its example and mastery status.

Progress is stored in the browser on your device.

## Run it

The app is static (HTML, CSS, JS). It loads its data with `fetch`, so serve the folder instead of opening the file directly:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

**GitHub Pages:** in the repo settings, go to *Pages*, choose *Deploy from a branch*, pick the branch and `/ (root)`. The app is then at `https://<user>.github.io/TCF-Vocab/`. Self-recording works there (the browser asks for the microphone).

## Project layout

| Path | What it is |
|---|---|
| `index.html` | Full page for GitHub Pages or a local server |
| `artifact.html` | Same app as a page fragment, for publishing as a claude.ai Artifact |
| `app/app.js`, `app/styles.css` | The app |
| `app/data/vocab.json` | Flashcards for every theme |
| `app/data/questions-<theme>.json` | Questions, sample responses and highlight positions |
| `sources/*.pdf` | The original sample-response PDFs |
| `tools/` | Scripts that turn the PDFs into `app/data` |
| `docs/VOCABULARY.md` | The full word list with examples, readable on GitHub |
| `docs/SPEC.md` | The app spec |

## Change the vocabulary or add PDFs

1. Edit `tools/vocab_list.txt`. Each line is `TYPE|french|gender|english|optional re:regex` (types: N, V, A, ADV, EXP).
2. To add a PDF, put it in `sources/` and add it to the list in `tools/rebuild.sh` (and to `LABELS` in `tools/parse_responses.py` and `CATS` in the other scripts if it is a new theme).
3. Run `tools/rebuild.sh`. It needs `pypdfium2` and `spacy` with the `fr_core_news_md` model.
