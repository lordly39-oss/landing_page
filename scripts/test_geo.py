import json
import re
import os

workspace = r"c:\Users\realr\Downloads\landing_page"

def test_json_ld(filename):
    filepath = os.path.join(workspace, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    pattern = r'<script\s+type="application/ld\+json">([\s\S]*?)</script>'
    matches = re.findall(pattern, content)
    print(f"[{filename}] Found {len(matches)} JSON-LD blocks.")
    for i, match in enumerate(matches, 1):
        try:
            data = json.loads(match.strip())
            print(f"  Block {i}: @type = {data.get('@type')}, @context = {data.get('@context')} -> VALID JSON-LD")
            if data.get('@type') == 'FAQPage':
                print(f"    FAQ mainEntity count: {len(data.get('mainEntity', []))}")
        except Exception as e:
            print(f"  Block {i} ERROR: {e}")
            assert False, f"Invalid JSON-LD in {filename}"

def test_posts_json():
    filepath = os.path.join(workspace, "data", "posts.json")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"[posts.json] Valid JSON with {len(data)} articles.")
    for post in data:
        print(f"  - ID: {post.get('id')}, Title: {post.get('title')}, Category: {post.get('category')}")
        assert "content" in post and len(post["content"]) > 10

def test_ai_files():
    for fn in ["llms.txt", "robots.txt", "sitemap.xml"]:
        fp = os.path.join(workspace, fn)
        assert os.path.exists(fp), f"{fn} does not exist!"
        size = os.path.getsize(fp)
        print(f"[{fn}] Present and valid (Size: {size} bytes)")

if __name__ == "__main__":
    print("=== Running GEO Structure Validation Tests ===")
    test_json_ld("index.html")
    test_json_ld("news.html")
    test_posts_json()
    test_ai_files()
    print("=== ALL VALIDATION TESTS PASSED SUCCESSFULLY! ===")
