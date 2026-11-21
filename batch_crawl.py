import json
import os
from crawler import get_test_detail

test_targets = [
    ("62b6b89bbbc57b27fe10fc20", "FULL TEST 2"),
    ("62b3dee2bbc57b27fe103b72", "MINI TEST 1"),
    ("614be60365d71f3a51f67196", "Part 1: Photos - Test 1"),
    ("614bed5b65d71f3a51f67220", "Part 2: Question & Response - Test 1"),
    ("61c14bec92d7f67f5140b12d", "Vocabulary - Topic: Contracts"),
]

output_dir = "c:/Toeic/wed/data"
os.makedirs(output_dir, exist_ok=True)

for tid, name in test_targets:
    out_file = os.path.join(output_dir, f"{tid}.json")
    if os.path.exists(out_file):
        print(f"Already exists: {name} ({tid})")
        continue
    print(f"Crawling {name} ({tid})...")
    try:
        data = get_test_detail(tid, name)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  -> Saved {data['totalQuestions']} questions!")
    except Exception as e:
        print(f"  -> Error: {e}")

print("Batch crawl complete!")
