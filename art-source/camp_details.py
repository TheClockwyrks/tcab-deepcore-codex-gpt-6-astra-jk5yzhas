"""Produced building-specific equipment and insignia."""
import json,subprocess,math
for name in ['ore-market','upgrade-shop','supply-depot']:
 path=f'art-source/surface_{name}.png.json';ops=json.load(open(path))
 def rect(x,y,w,h,c):ops.append(dict(op='fill_rect',x=int(x),y=int(y),width=int(w),height=int(h),color=c))
 def circ(x,y,r,c):ops.append(dict(op='fill_circle',cx=int(x),cy=int(y),r=int(r),color=c))
 if name=='upgrade-shop':
  rect(30,14,15,35,'#526e72');rect(25,11,25,7,'#8a9d93');rect(108,40,44,30,'#203a46');circ(130,54,12,'#d9b66e');circ(130,54,6,'#213b47')
  for angle in range(0,360,45):rect(128+13*math.cos(math.radians(angle)),52+13*math.sin(math.radians(angle)),5,5,'#d9b66e')
  rect(37,81,46,40,'#1c3440');rect(41,108,36,5,'#9bbaa9');rect(51,87,6,25,'#cad3ae');rect(48,84,12,7,'#d2b174');rect(67,93,5,18,'#c7925d');rect(64,86,12,9,'#869e99')
 elif name=='supply-depot':
  for x,y,w in [(25,107,27),(48,101,32),(174,108,29),(160,119,36)]:
   rect(x,y,w,26,'#293b3e');rect(x+2,y+2,w-4,21,'#a0804b');rect(x+5,y+3,4,20,'#d0b777');rect(x+w-9,y+3,4,20,'#5c5d47');rect(x+3,y+11,w-6,3,'#4a594e')
  rect(107,42,48,23,'#c6a66a');rect(125,46,12,15,'#334c4f');rect(120,51,22,5,'#334c4f')
 else:
  rect(106,43,44,23,'#91a48c');rect(125,48,5,13,'#314d51');rect(115,50,25,3,'#314d51');rect(113,54,10,4,'#314d51');rect(135,54,10,4,'#314d51')
  for x,y in [(28,123),(40,120),(55,124),(204,124)]:circ(x,y,5,'#b6ad8e');rect(x-3,y-3,4,2,'#e6d8b0')
 json.dump(ops,open(path,'w'))
 subprocess.run(['draw','render','--actions',path,'--out',f'assets/surface/{name}.png','--width','240','--height','160','--no-layers'],check=True,stdout=subprocess.DEVNULL)
