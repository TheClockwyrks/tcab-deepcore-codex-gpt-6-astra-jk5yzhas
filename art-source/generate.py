"""One-time original pixel art authoring. Not invoked by the build."""
import json,random,subprocess,os,math
random.seed(82)
ops=[]
def rect(x,y,w,h,c): ops.append(dict(op='fill_rect',x=int(x),y=int(y),width=max(1,int(w)),height=max(1,int(h)),color=c))
def circ(x,y,r,c): ops.append(dict(op='fill_circle',cx=int(x),cy=int(y),r=int(r),color=c))
def line(x,y,a,b,c): ops.append(dict(op='line',x0=int(x),y0=int(y),x1=int(a),y1=int(b),color=c))
def save(path,w=80,h=80,sheet=False):
 os.makedirs('assets/'+os.path.dirname(path),exist_ok=True)
 log='art-source/'+path.replace('/','_')+'.json';open(log,'w').write(json.dumps(ops))
 subprocess.run(['draw-sheet' if sheet else 'draw','render','--actions',log,'--out','assets/'+path,'--width',str(w),'--height',str(h),'--no-layers'],check=True,stdout=subprocess.DEVNULL)
 ops.clear()
def poly(points,c):
 for y in range(int(min(p[1] for p in points)),int(max(p[1] for p in points))+1):
  xs=[]
  for i,(x1,y1) in enumerate(points):
   x2,y2=points[(i+1)%len(points)]
   if (y1<=y<y2) or (y2<=y<y1):xs.append(x1+(y-y1)/(y2-y1)*(x2-x1))
  xs.sort()
  for i in range(0,len(xs)-1,2):rect(xs[i],y,xs[i+1]-xs[i]+1,1,c)
palettes=[['#514335','#5c4c3b','#685440','#41382f'],['#3c4d53','#465960','#52656b','#303e45'],['#333345','#3c3c50','#48475b','#262936'],['#4b3038','#59353d','#684047','#392731']]
for band,pal in zip(['topsoil','rockbed','deepstone','coreshell'],palettes):
 for n in range(3):
  rect(0,0,80,80,pal[0])
  for i in range(1400):rect(random.randrange(80),random.randrange(80),random.choice([1,2,3]),1,random.choice(pal))
  for i in range(15):
   x,y=random.randrange(80),random.randrange(80);line(x,y,x+random.randrange(4,12),y+random.randrange(-2,3),pal[3]);line(x,y+1,x+5,y+1,pal[2])
  save(f'tiles/{band}-{n}.png')
for name in ['bedrock','stone-0','stone-1','tunnel']:
 rect(0,0,80,80,'#111e26' if name=='tunnel' else '#26363e')
 if name!='tunnel':
  for x,y,r in [(22,22,21),(55,25,25),(32,58,28),(66,65,24)]:
   circ(x,y,r,'#15272f');circ(x,y-3,r-3,'#54666c');circ(x+3,y+1,r-5,'#3b4c54');line(x-r//2,y-r//2,x+9,y-r//2-3,'#819097')
 for i in range(180):rect(random.randrange(80),random.randrange(80),1,1,'#25323a' if name=='tunnel' else '#617178')
 save('tiles/'+name+'.png')
colors=['#a7a69c','#dac47c','#e89859','#d4e7e8','#6da9ed','#dcd878','#b1e1ba','#ec754f','#d596b7','#c8eafa','#76e6ab','#e983b6','#f6d281']
for name,color in zip(['ferron','marlite','cuprite','argenite','cobaltine','voltite','halcite','pyronium','cindrite','adamite','verdite','roselite','aurite'],colors):
 if name in ['verdite','roselite','aurite']:
  poly([(40,10),(61,24),(65,45),(40,69),(17,44),(20,24)],'#152b39');poly([(40,14),(59,26),(62,43),(40,65),(20,43),(23,26)],color)
  poly([(23,26),(34,32),(40,65),(20,43)],'#426474');poly([(34,32),(48,32),(57,26),(40,16)],'#f0f9de');poly([(48,32),(62,43),(40,65)],'#577b80');line(40,17,40,9,'#ffffff');line(35,13,46,13,'#ffffff')
 else:
  for x in range(80):
   y=int(40+12*math.sin(x/19))
   for i in range(6):
    yy=y+random.randrange(-13,14);rect(x,yy,random.randrange(1,5),random.randrange(1,4),color+random.choice(['aa','cc','ff','66']))
  for i in range(22):
   x=random.randrange(80);y=int(40+12*math.sin(x/19))+random.randrange(-8,8);rect(x,y,3,2,'#fff2cc')
 save('ore/'+name+'.png')
for name,col in [('resonite','#71dfc3'),('cryenite','#9d9cf4'),('core','#ffab65'),('core-sample','#ffd995')]:
 for x,y,sz in [(30,50,22),(48,48,29),(55,59,18)]:
  poly([(x-sz//2,y),(x-8,y-sz),(x+3,y-sz-9),(x+sz//2,y-4),(x,y+8)],'#24384b');poly([(x-sz//2+3,y),(x-5,y-sz),(x+3,y-sz-6),(x,y+5)],col);poly([(x+3,y-sz-6),(x+sz//2-2,y-4),(x,y+5)],'#55768b');line(x-4,y-sz,x-2,y-6,'#e1fff1')
 save('materials/'+name+'.png')
for n in range(4):
 for i in range(n+2):
  x,y=40,40
  for j in range(5):
   a=x+random.randrange(-15,16);b=y+random.randrange(-12,13);line(x,y,a,b,'#0a101eee');line(x+1,y,a+1,b,'#d3aa6466');x,y=a,b
 save(f'tiles/crack/frame{n:02}.png',sheet=True)
for n in range(4):
 rect(0,0,80,80,'#b43d31')
 for i in range(55):
  x,y=random.randrange(80),random.randrange(80);circ(x,y,random.randrange(2,10),random.choice(['#e85c32','#fa9b40','#ffce67','#7f302f']))
 for y in range(0,80,14):
  for x in range(80):rect(x,y+int(3*math.sin(x/8+n)),2,2,'#ffd37b')
 save(f'hazards/lava/frame{n:02}.png',sheet=True)
# The same amber pressure suit, blue visor, rear pack and steel drill in every pose.
for state,frames in [('idle',4),('walk',6),('drill-down',4),('drill-side',4),('jetpack',4),('fall',3),('hurt',3),('fuel-out',3)]:
 for f in range(frames):
  bob=[0,1,2,1][f%4];lean=3 if state=='drill-side' else -3 if state=='hurt' else 0
  if state=='fuel-out':bob+=7
  if state=='jetpack':
   poly([(18,52),(34,52),(30,70+f%3*3),(25,64),(21,79)],'#ed7244');poly([(22,53),(30,53),(26,71-f%3*3)],'#ffe7a4')
  rect(13,29+bob,17,28,'#101f2c');rect(15,31+bob,12,22,'#778c8c');rect(15,34+bob,5,15,'#b9c6b3');rect(14,55+bob,14,5,'#263844')
  legs=[-3,1,4,1,-3,0][f%6] if state=='walk' else 0
  for x,dy in [(30,legs),(45,-legs)]:
   rect(x,52+bob,12,17+dy,'#142735');rect(x+2,53+bob,8,12+dy,'#b8793a');rect(x-2,67+bob+dy,17,6,'#172632');rect(x-1,67+bob+dy,15,2,'#94a09a')
  rect(26+lean,29+bob,31,29,'#142735');rect(29+lean,31+bob,25,24,'#d39b4e');rect(30+lean,33+bob,6,18,'#f0bc67');rect(29+lean,48+bob,26,5,'#71543b');rect(37+lean,37+bob,13,7,'#405e62');rect(40+lean,39+bob,6,2,'#b2e9c7')
  circ(42+lean,23+bob,18,'#132530');circ(42+lean,22+bob,15,'#dba751');rect(28+lean,23+bob,30,10,'#122c3e');rect(35+lean,24+bob,22,7,'#3c7c8c');rect(38+lean,24+bob,17,2,'#9ce4db');rect(26+lean,18+bob,31,4,'#f3c877');rect(53+lean,17+bob,9,8,'#344d52');rect(55+lean,18+bob,7,5,'#fff2b8' if f%2 else '#e1db98')
  if state=='drill-down':
   rect(46,43,12,22,'#283e49');rect(47,45,9,16,'#8baca9');poly([(47,61),(57,61),(52+f%2,79)],'#b7c9be');rect(39,43,16,9,'#e3a451')
  else:
   yy=43+bob+(4 if state=='fall' else 0);rect(48,yy,20,12,'#1b303d');rect(50,yy+2,17,7,'#91aba5');poly([(66,yy),(79,yy+6),(66,yy+12)],'#bdc9b8');line(68,yy+3,73,yy+8,'#4c666d');rect(45,yy-4,12,10,'#e4ae5b')
  save(f'miner/{state}/frame{f:02}.png',sheet=True)
# Camp: hand-built equipment silhouettes, panel seams, cables, lamps and hazard stripes.
for idx,name in enumerate(['fuel-depot','ore-market','save-pad','upgrade-shop','supply-depot','launch-pad']):
 rect(8,136,224,16,'#15252e');rect(13,133,214,6,'#72817a')
 if idx==0:
  for x in [25,110]:
   circ(x+25,56,25,'#92a29a');rect(x,56,50,72,'#81958f');rect(x+5,60,9,65,'#b1b9a2');rect(x+38,60,10,66,'#435f63');rect(x,81,50,10,'#d2984e');rect(x+17,31,15,8,'#48626b')
  rect(175,77,34,55,'#caa15d');rect(181,84,22,17,'#153c49');rect(184,88,16,4,'#8be0c0');line(207,100,222,106,'#0b1e29');line(222,106,219,128,'#0b1e29')
 elif idx==2:
  rect(73,111,93,22,'#2b4e58');rect(82,106,75,5,'#71d5c4');rect(113,40,18,66,'#596f72');rect(97,32,50,36,'#243e4b');rect(103,38,38,22,'#94dab9');rect(112,43,20,4,'#e8ffe2');line(122,31,122,12,'#adbc9e');circ(122,9,3,'#f6c36a')
 elif idx==5:
  rect(40,118,160,15,'#46545a');rect(43,35,10,83,'#788480');rect(47,33,112,7,'#98a296');line(48,42,135,97,'#6d7c7b');rect(147,37,5,60,'#5b7478')
 else:
  poly([(18,64),(48,36),(183,36),(219,65)],'#83938b');rect(22,65,194,67,'#394f56');rect(30,70,178,55,'#52676a');rect(35,75,51,49,'#1e3542');rect(40,80,41,32,'#3e7076');rect(44,83,33,3,'#a4d0bd');rect(94,78,63,47,'#263e49');rect(98,81,55,6,'#788e87');rect(98,94,55,4,'#788e87');rect(98,108,55,4,'#788e87');rect(170,75,29,49,'#c59c58');rect(175,80,19,12,'#203e4b');circ(185,102,5,'#a9dfc0')
  rect(60,50,111,18,'#142d3a')
  for x in range(66,164,13):rect(x,55,7,3,'#d8bd7c')
 for x in range(17,224,20):poly([(x,135),(x+8,135),(x+14,142),(x+6,142)],'#d3a355')
 for x in [25,208]:rect(x,127,4,4,'#e5c27b')
 save('surface/'+name+'.png',240,160)
for stage in range(6):
 rect(10,183,140,12,'#3a535e');rect(17,180,125,4,'#c29b64')
 if stage:
  rect(62,80,40,97,'#a4b3ae');rect(64,85,9,86,'#d8dac3');rect(92,85,8,88,'#546b73');poly([(62,80),(82,39),(102,80)],'#e4ca91');rect(59,162,47,12,'#253f4d')
 if stage>=2:rect(58,119,48,14,'#db9953');rect(63,123,39,3,'#f2ce83')
 if stage>=3:circ(82,95,13,'#213e51');circ(82,95,9,'#65b4bd');rect(78,89,9,3,'#d1f4df')
 if stage>=4:poly([(62,135),(39,171),(39,181),(63,169)],'#d6944d');poly([(102,135),(125,171),(125,181),(101,169)],'#b47c48')
 if stage>=5:rect(71,174,24,8,'#5e7f86');rect(76,176,14,4,'#f4d88b');rect(79,53,5,20,'#e79755')
 save(f'rocket/stage{stage}.png',160,200)
rect(0,0,1280,400,'#101f2c')
for y in range(400):rect(0,y,1280,1,f'#{16+y//40:02x}{31+y//32:02x}{44+y//28:02x}')
for i in range(160):
 x,y=random.randrange(1280),random.randrange(310);rect(x,y,1 if i%4 else 2,1,'#8ca29b')
for layer,col in [(0,'#243b46'),(1,'#1b313e')]:
 points=[(0,400)]+[(x,random.randrange(260+layer*35,370)) for x in range(0,1340,60)]+[(1280,400)];poly(points,col)
circ(1000,110,44,'#536970');circ(1010,104,37,'#52676e');circ(986,95,8,'#485f68');circ(1004,122,12,'#485f68');save('surface/sky.png',1280,400)
rect(0,0,80,24,'#253a40');rect(0,2,80,4,'#a38b67')
for i in range(100):rect(random.randrange(80),random.randrange(7,24),3,1,random.choice(['#3c4b48','#6d6b55','#879076']))
save('surface/ground.png',80,24)
poly([(1,80),(3,35),(18,7),(62,7),(78,35),(79,80)],'#2c4148');poly([(12,80),(12,35),(26,17),(55,17),(68,35),(68,80)],'#0b1925')
for x in [6,68]:rect(x,38,6,42,'#bc9050');rect(x,35,6,7,'#ffda8d')
save('surface/cave-mouth.png')
for i,name in enumerate(['fuel','hull','cargo','credits','depth','resonite','cryenite','core-sample']):
 col=['#e9b663','#85d1bb','#b6c4b5','#efcf79','#85aebf','#71dfc3','#9d9cf4','#ffb466'][i]
 if i==0:poly([(10,2),(18,12),(18,19),(12,22),(5,18),(5,12)],col)
 elif i==1:poly([(3,4),(12,2),(21,4),(19,16),(12,22),(5,16)],col);rect(10,6,4,11,'#244047')
 elif i==2:rect(3,6,18,15,col);rect(8,3,8,4,col);rect(4,11,16,2,'#30474e')
 elif i==3:circ(12,12,9,col);circ(12,12,6,'#60553e');rect(10,6,4,12,col)
 elif i==4:rect(10,2,4,13,col);poly([(4,13),(20,13),(12,22)],col)
 else:poly([(12,1),(21,9),(16,22),(7,21),(3,9)],col);line(12,3,8,17,'#efffe2')
 save('icons/'+name+'.png',24,24)
