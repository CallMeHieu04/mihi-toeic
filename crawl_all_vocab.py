import json
import os
import time
from crawl_all_tests import fetch_and_save_test, DATA_DIR

with open(os.path.join(DATA_DIR, "practice_full_summary.json"), encoding="utf-8") as f:
    full = json.load(f)

vocab_topics = full["vocabulary"]["byTopic"] + full["vocabulary"]["byPart"]
print(f"Caching {len(vocab_topics)} Vocabulary topics...")

for idx, t in enumerate(vocab_topics):
    fetch_and_save_test(t["id"], f"Vocabulary: {t['name']}")
    time.sleep(0.1)

print("Vocabulary topics cached!")
