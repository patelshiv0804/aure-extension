import re
import base64

with open(r'd:\prompt enhancer extension chrome\logo_1.svg', 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'data:image/png;base64,([^"]+)', content)
if match:
    img_data = base64.b64decode(match.group(1))
    with open(r'C:\Users\patel\.gemini\antigravity-ide\brain\9d07dbeb-c32e-4d57-b27e-72abdeefa950\logo_test.png', 'wb') as f:
        f.write(img_data)
    print("PNG written successfully")
else:
    print("Base64 not found")
