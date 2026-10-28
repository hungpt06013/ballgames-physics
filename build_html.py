# Inline all game scripts into one self-contained HTML file
import sys
www = 'www/'
html = open(www + 'index.html', encoding='utf-8').read()
for name in ["engine.js", "audio.js", "meta.js", "draw.js", "highlights.js", "game.js"]:
    js = open(www + name, encoding='utf-8').read().replace('</script>', '<\\/script>')
    tag = '<script src="%s"></script>' % name
    assert tag in html
    html = html.replace(tag, '<script>\n' + js + '\n</script>')
open(sys.argv[1], 'w', encoding='utf-8').write(html)
print('wrote', sys.argv[1], len(html))
