# TCF Tâche 3 Vocab and Practice App: Spec (draft for approval)

## 1. Goal

One app to prepare for TCF Expression orale, Tâche 3, by category:

1. Learn the topic vocabulary with flashcards (word, translation, real example sentence).
2. Practise real Tâche 3 questions from the same category under exam conditions.
3. Compare with the sample response, with the category vocabulary highlighted in it.

## 2. Content

| Source | Count |
|---|---|
| Categories | Culture, Économie, Technologie, Santé, Famille, Éducation |
| Extra deck | Argumentation (34 connectors and opinion phrases, used in every category) |
| Flashcards | 501 (about 78 per category) |
| Questions with sample responses | about 600 (Culture 176, Éducation 148, Économie 136, Santé 105, Technologie 80, Famille 74) |

Each flashcard has: French word (nouns with le/la/l' and gender), word type, English translation, one example sentence taken from a sample response in that category, and a link to the response it came from.

When the same question appears more than once with different sample responses, they are grouped under one question with "Réponse 1 / 2" tabs.

## 3. Screens

### 3.1 Home
- A card for each category plus Argumentation, showing: number of words, words mastered, questions practised.
- "Continue where I left off" button.

### 3.2 Category page
Two tabs: **Flashcards** and **Pratique Tâche 3**, plus a small **Liste** tab to browse every word in a table.

### 3.3 Flashcards
- **Front:** French word with a type badge (nom, verbe, adjectif, adverbe, expression) and gender for nouns.
- **Tap to flip. Back:** English translation and the example sentence with the word in bold. A "Voir la réponse" link opens the full sample response it came from.
- 🔊 button reads the word and the sentence aloud in French (built-in browser voice, free, works offline on most phones).
- After flipping, two buttons: **À revoir** (again) and **Je sais** (got it).
- **Options:**
  - Direction: French → English (default) or English → French.
  - Filter by word type (e.g. only verbs).
  - Order: smart review (default), random, or list order.
- **Smart review:** simple Leitner boxes. "À revoir" moves the card back to box 1, "Je sais" moves it up one box. Cards in lower boxes come back more often. A card in box 5 counts as **mastered**.
- End of session summary: cards seen, known, to review.

### 3.4 Pratique Tâche 3
Mirrors the real exam: no preparation time, about 4 min 30 s to speak.

1. **Pick a question:** random (default) or choose from the list. Unpractised questions are shown first.
2. **Question screen:** the question in large text, plus a **Start** button.
3. **Speaking:** a 4:30 countdown timer (adjustable). Optional:
   - **Record myself** (uses the phone/computer microphone; the recording stays on the device and can be played back after).
   - **Indices** toggle: shows 8 to 10 useful words from this category (those that appear in the sample response) and a few Argumentation connectors, so you can try to use them.
4. **Sample response:** revealed after the timer ends or at any time with "Voir la réponse".
   - Paragraph structure kept (intro, arguments, conclusion).
   - Category vocabulary and connectors are highlighted; tapping a highlighted word shows its translation and lets you add it to "À revoir".
   - If you recorded yourself, your recording can be played above the response for comparison.
5. **Mark as practised**, then "Question suivante".

### 3.5 Liste (per category)
Searchable table of every word: French, type, English, example. Shows mastery status. Useful for quick revision.

### 3.6 Global search
One search box that finds a word or a question across all categories.

## 4. Progress and storage
- Progress (Leitner boxes, practised questions, last position) is saved in the browser on your device. No account, no login.
- "Reset progress" per category and globally.
- Voice recordings are not saved after you leave the page (keeps it simple and private).

## 5. Design
- Mobile-first, works well on a phone and on a laptop.
- Clean, readable typography; large text on cards and questions.
- Light and dark mode following the device setting.
- Keyboard shortcuts on desktop: Space to flip, 1 = À revoir, 2 = Je sais, arrows to move.

## 6. Technical approach
- A static web app (HTML, CSS, JavaScript) with no server and no build step needed to run it.
- Data lives in JSON files: `vocab.json` (flashcards) and one file per category with the questions and responses.
- A `tools/` folder keeps the scripts that turned your PDFs into this data, so new PDFs or categories can be added later by rerunning them.
- **Hosting (recommended):** publish it as a private claude.ai Artifact page. You get a link that works on your phone and laptop, and only you can open it unless you choose to share it. The repo keeps the source code.

## 7. Not included (can add later)
- Automatic scoring or AI feedback on your spoken answer.
- Speech-to-text transcription of your recording.
- Syncing progress between devices.

## 8. Open question for you
The repo `Swaleha-12/TCF-Vocab` is **public**. The app needs the full sample responses. Options:
- **A (recommended):** make the repo private, then I commit everything (code and data).
- **B:** keep the repo public. I commit only the code and scripts, and the data (your sample responses and vocabulary) goes only into the private hosted app.
- **C:** keep it public and commit everything anyway.
