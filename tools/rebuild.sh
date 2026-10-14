#!/usr/bin/env bash
# Rebuild app/data from the PDFs in sources/.
# Needs: pip install pypdfium2 spacy && python -m spacy download fr_core_news_md
set -euo pipefail
cd "$(dirname "$0")/.."
WORK="${WORK:-build}"
mkdir -p "$WORK/lines" "$WORK/parsed"
for pair in Culture:culture Economie:economie Technologie:technologie Sante:sante Famille:famille Education:education; do
  python3 tools/extract_lines.py "sources/${pair%%:*}.pdf" "$WORK/lines/${pair##*:}.jsonl"
done
python3 tools/parse_responses.py "$WORK/lines" "$WORK/parsed"
python3 tools/analyze.py "$WORK/parsed" "$WORK/analysis.json"
python3 tools/build_vocab.py "$WORK" tools/vocab_list.txt "$WORK/vocab.json"
python3 tools/build_app_data.py "$WORK" "$WORK/vocab.json" app/data
echo "Done: app/data rebuilt"
