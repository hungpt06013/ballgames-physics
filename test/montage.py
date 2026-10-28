import sys
from PIL import Image
out=sys.argv[1]; files=sys.argv[2:]
ims=[Image.open(f).convert('RGB').resize((800,380)) for f in files]
cols=2; rows=(len(ims)+1)//2
M=Image.new('RGB',(1600,380*rows),'white')
for i,im in enumerate(ims): M.paste(im,((i%2)*800,(i//2)*380))
M.save(out)
