import os
import re

# Sections mapped to files
sections = [
    ("STATE", "infrastructure/store.js"),
    ("TRAKT AUTH", "data/auth.js"),
    ("ANILIST AUTH (Implicit OAuth)", "data/auth.js"),
    ("LAUNCH APP", "main.js"),
    ("TRAKT API", "data/apiTrakt.js"),
    ("LISTS DISCOVERY", "data/apiTrakt.js"),
    ("DATA LOADING", "application/sync.js"),
    ("DEMO", "utils/demo.js"),
    ("FILTERS", "presentation/filters.js"),
    ("CONFIG / SETTINGS", "presentation/settings.js"),
    ("FRANCHISE ENGINE", "domain/franchises.js"),
    ("RENDER - FILA", "presentation/uiRenderer.js"),
    ("RENDER - HISTORY", "presentation/uiRenderer.js"),
    ("RENDER - REVISITED", "presentation/uiRenderer.js"),
    ("TABS & UI", "presentation/uiRenderer.js"),
    ("BOOKS", "domain/books.js"),
    ("GAMES", "domain/games.js"),
    ("CONTEXT QUEUE (AGORA)", "presentation/agora.js"),
    ("EXTEND STATE for books/games", "infrastructure/store.js"),
    ("POSTER ENGINE", "data/posters.js"),
    ("YOUTUBE QUEUE", "domain/youtube.js"),
    ("SHUFFLE", "presentation/shuffle.js"),
    ("BACKUP & RESTORE", "utils/backup.js"),
    ("EXPLICATIVE HELP & CRONÔMETRO FUNCTIONS", "presentation/timeDetails.js"),
    ("EXTREME END", "main.js")
]

with open("src/main.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Split into chunks based on ══════════════════════════════════════════
chunks = []
current_chunk = []
for line in lines:
    if "══════════════════════════════════════════" in line:
        if current_chunk:
            chunks.append(current_chunk)
            current_chunk = []
    current_chunk.append(line)
if current_chunk:
    chunks.append(current_chunk)

# Identify section names and assign to files
file_contents = {}

for chunk in chunks:
    # Find the title
    title = ""
    for line in chunk[:5]:
        if line.strip().startswith("//") and not "═══" in line:
            title = line.strip()[2:].strip()
            if title: break
    
    file_path = "main.js" # Default
    for s_title, s_path in sections:
        if s_title in title:
            file_path = s_path
            break
            
    if file_path not in file_contents:
        file_contents[file_path] = []
    file_contents[file_path].extend(chunk)

# Extract exports
exports_by_file = {}
all_exports = set()

def extract_exports(content, file_path):
    new_content = []
    exports = []
    for line in content:
        # Match function declarations
        m = re.match(r'^(\s*)(async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(', line)
        if m:
            indent = m.group(1)
            async_k = m.group(2) or ""
            name = m.group(3)
            exports.append(name)
            line = f"{indent}export {async_k}function {name}(" + line[len(m.group(0)):]
        
        # Match const S = { ... }
        if line.startswith("const S = {") or line.startswith("let S = {"):
            exports.append("S")
            line = line.replace("const S", "export const S").replace("let S", "export let S")
            
        # Match const DSEED = ...
        if line.startswith("const DSEED"):
            exports.append("DSEED")
            line = line.replace("const DSEED", "export const DSEED")
            
        # Match ratingsCache etc
        if line.startswith("let ratingsCache") or line.startswith("let _dAll") or line.startswith("let posterCache"):
            var_name = line.split(" ")[1]
            exports.append(var_name)
            line = line.replace("let " + var_name, "export let " + var_name)
            
        new_content.append(line)
    
    exports_by_file[file_path] = exports
    all_exports.update(exports)
    return new_content, exports

for fp, content in file_contents.items():
    new_content, exports = extract_exports(content, fp)
    file_contents[fp] = new_content

# Add imports based on usage
for fp, content in file_contents.items():
    text = "".join(content)
    imports_to_add = {}
    
    for other_fp, exports in exports_by_file.items():
        if other_fp == fp: continue
        needed = []
        for exp in exports:
            # Check if export is used in this file as a word
            # using regex boundary
            if re.search(r'\b' + exp + r'\b', text):
                needed.append(exp)
        if needed:
            imports_to_add[other_fp] = needed
            
    # Prepend imports
    import_lines = []
    for other_fp, needed in imports_to_add.items():
        # calculate relative path
        depth = fp.count("/")
        prefix = "../" * depth if depth > 0 else "./"
        if other_fp == "main.js" and depth > 0:
            rel_path = prefix + "main.js"
        else:
            rel_path = prefix + other_fp
        
        # In Vite we might need to be careful with extensions, but we use .js
        import_lines.append(f"import {{ {', '.join(needed)} }} from '{rel_path}';\n")
        
    file_contents[fp] = import_lines + ["\n"] + file_contents[fp]

# Add window attachments to main.js so inline HTML events still work
window_attachments = []
for exp in all_exports:
    window_attachments.append(f"window.{exp} = {exp};\n")

file_contents["main.js"].extend(["\n// Expose for inline HTML events\n"] + window_attachments)

# Write files
for fp, content in file_contents.items():
    full_path = os.path.join("src", fp)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.writelines(content)
        
print("Refactoring complete.")
