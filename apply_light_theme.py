import os
import re

components_dir = r"d:\prompt enhancer extension chrome\src\components"

replacements = [
    (r'text-white/20', 'text-slate-400/60'),
    (r'text-white/30', 'text-slate-400'),
    (r'text-white/40', 'text-slate-500'),
    (r'text-white/50', 'text-slate-500'),
    (r'text-white/60', 'text-slate-600'),
    (r'text-white/70', 'text-slate-700'),
    (r'text-white/80', 'text-slate-800'),
    (r'text-white/90', 'text-slate-900'),
    (r'text-white', 'text-slate-900'),
    
    (r'border-white/5', 'border-slate-200/60'),
    (r'border-white/8', 'border-slate-200'),
    (r'border-white/10', 'border-slate-200'),
    (r'border-white/30', 'border-slate-300'),
    
    (r'bg-white/\[0\.01\]', 'bg-slate-50/50'),
    (r'bg-white/\[0\.02\]', 'bg-white'),
    (r'bg-white/\[0\.03\]', 'bg-white'),
    (r'bg-white/\[0\.04\]', 'bg-slate-50/50'),
    (r'bg-white/\[0\.05\]', 'bg-slate-50'),
    (r'bg-white/\[0\.06\]', 'bg-slate-50'),
    (r'bg-white/5', 'bg-slate-100'),
    (r'bg-white/10', 'bg-slate-100'),
    (r'bg-white/20', 'bg-slate-200'),
    
    (r'hover:bg-white/\[0\.03\]', 'hover:bg-slate-50'),
    (r'hover:bg-white/\[0\.04\]', 'hover:bg-slate-100'),
    (r'hover:bg-white/\[0\.06\]', 'hover:bg-slate-100'),
    (r'hover:bg-white/5', 'hover:bg-slate-100'),
    (r'hover:bg-white/10', 'hover:bg-slate-100'),
    (r'hover:bg-error-500/5', 'hover:bg-error-50'),
    
    (r'placeholder-white/30', 'placeholder-slate-400'),
    
    # Active tab colors
    (r'activeTab === tab\.id \?\s*\'text-slate-900\'\s*:\s*\'text-slate-500/40 hover:text-slate-500/60\'',
     'activeTab === tab.id ? \'text-primary-600\' : \'text-slate-400 hover:text-slate-600\''),
    (r'activeTab === tab\.id \?\s*\'text-slate-900\'\s*:\s*\'text-slate-500 hover:text-slate-500\'',
     'activeTab === tab.id ? \'text-primary-600\' : \'text-slate-400 hover:text-slate-600\''),
     
    # Glass style resets
    (r'bg-surface/80', 'bg-white/90'),
]

for root, dirs, files in os.walk(components_dir):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            modified = content
            for pattern, repl in replacements:
                modified = re.sub(pattern, repl, modified)
            
            if modified != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(modified)
                print(f"Updated {file}")
