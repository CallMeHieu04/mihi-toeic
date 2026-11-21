import json
import os
import time
from crawl_all_tests import fetch_and_save_test, DATA_DIR

with open(os.path.join(DATA_DIR, "practice_full_summary.json"), encoding="utf-8") as f:
    full = json.load(f)

total_tests = []
for p in full["parts"]:
    for t in p.get("tests", []):
        total_tests.append((t["id"], f"{p['name']} - {t['name']}"))

print(f"Total Part tests to cache: {len(total_tests)}")

for idx, (t_id, t_name) in enumerate(total_tests):
    fetch_and_save_test(t_id, t_name)
    time.sleep(0.1)

print("\nALL Part Practice Tests CACHED!")
