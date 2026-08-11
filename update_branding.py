import os

files_to_update = [
    'manifest.json',
    'src/components/popup/PopupRoot.tsx',
    'src/components/settings/SettingsRoot.tsx',
    'src/components/sidepanel/SidePanelRoot.tsx',
    'src/entrypoints/options/index.html',
    'src/entrypoints/popup/index.html',
    'src/entrypoints/sidepanel/index.html',
    'src/entrypoints/background/index.ts',
    'src/entrypoints/content/index.tsx',
    'src/components/content/ContentRoot.tsx',
    'src/components/content/InlineSuggestions.tsx',
    'src/lib/messaging.ts'
]

ui_replacement = '''<img src="/logo.png" className="w-8 h-8 rounded-xl object-contain" alt="AURE Logo" />'''

for file in files_to_update:
    path = os.path.join(r'd:\prompt enhancer extension chrome', file)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace simple strings
        content = content.replace('PromptEnhancer AI', 'AURE')
        content = content.replace('PromptEnhancer', 'AURE')
        
        # For the UI placeholders
        # PopupRoot, SidePanelRoot, SettingsRoot have similar structures:
        # <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm" style={{ background: ... }}>?</div>
        
        # Let's replace the whole block by finding it using regex
        import re
        content = re.sub(
            r'<div\s+className="w-[89] h-[89] rounded-xl flex items-center justify-center text-sm"\s+style={{[^}]+}}\s*>\s*?\s*</div>',
            ui_replacement,
            content,
            flags=re.MULTILINE
        )

        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {file}')
