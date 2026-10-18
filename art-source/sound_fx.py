import json,subprocess,os

def run(tool,cfg,*args):subprocess.run([tool,'--config',cfg,*map(str,args)],check=True,stdout=subprocess.DEVNULL)
for i,name in enumerate(['gas-seep','drill-debris','jetpack-exhaust','ore-sparkle','material-shimmer','gas-explosion','lava-embers','impact-dust','core-extract','core-detonation','launch-exhaust','death-burst']):
 cfg=f'art-source/{name}.config.json';big=name in ['gas-explosion','core-detonation','launch-exhaust'];col='#a5d5c5' if name=='gas-seep' else '#a9f6dd' if 'shimmer' in name or 'extract' in name else '#ffca76'
 json.dump(dict(width=256,height=256,duration_ms=1400,fps=30,seed=42+i,actions=f'art-source/{name}.actions.json',preview=f'/tmp/{name}.png',system=f'assets/fx/{name}.json'),open(cfg,'w'))
 run('particle-2d',cfg,'init');run('particle-2d',cfg,'add-emitter','--name','chips','--shape','disc','--radius',25 if name=='gas-seep' else 4,'--x',128,'--y',128,'--burst',70 if big else 16,'--lifetime',1000 if big else 650,'--lifetime-spread',200,'--speed',150 if big else 45,'--speed-spread',30,'--cone-angle',180 if big or 'sparkle' in name else 35,'--dir-y',-1 if 'exhaust' in name else 1)
 run('particle-2d',cfg,'set-particle','--emitter','chips','--size-from',2 if big else 0.8,'--size-to',0.1,'--opacity-from',0.16 if name=='gas-seep' else 0.9,'--opacity-to',0,'--color-gradient',col+'@0,#755969@1')
 if big:
  run('particle-2d',cfg,'add-emitter','--name','flash','--shape','point','--x',128,'--y',128,'--burst',1,'--lifetime',300,'--speed',0)
  run('particle-2d',cfg,'set-particle','--emitter','flash','--size-from',9,'--size-to',0,'--color-gradient','#fff2c2@0,#ed7953@1')
 run('particle-2d',cfg,'render','--frame',12)
for i,name in enumerate(['drill','thrust','ore-pickup','material-chime','gas-explosion','lava-sizzle','impact','fabricate','launch','death','alarm-fuel','alarm-core']):
 cfg=f'art-source/{name}.audio.json';dur=1500 if name=='launch' else 500 if name in ['drill','thrust'] else 700
 json.dump(dict(sample_rate=22050,channels='mono',max_duration_ms=dur+500,seed=10+i,actions=f'art-source/{name}.sound.json',preview=f'/tmp/{name}-sound.png',wav=f'assets/audio/{name}.wav'),open(cfg,'w'))
 run('sfx-synth',cfg,'init');noise=name in ['drill','thrust','gas-explosion','lava-sizzle','impact','launch','death']
 run('sfx-synth',cfg,'add-voice','--name','body','--wave','noise' if noise else 'sine','--freq',90 if noise else 520+i*40,'--dur',dur,'--gain=-24' if noise else '--gain=-20')
 run('sfx-synth',cfg,'add-voice','--name','metal','--wave','triangle','--freq',65 if noise else 780+i*45,'--dur',dur*0.7,'--gain=-25')
 run('sfx-synth',cfg,'set-pitch','--voice','metal','--slide-to',35 if noise else 1100,'--over',dur)
 run('sfx-synth',cfg,'render')
cfg='art-source/music.config.json';json.dump(dict(sample_rate=22050,channels='stereo',max_duration_ms=32000,seed=9,instrument_bank='gm-lite',actions='art-source/music.actions.json',preview='/tmp/music.png',wav='assets/audio/music.wav',mid='assets/audio/music.mid'),open(cfg,'w'))
run('music',cfg,'init');run('music',cfg,'set-tempo','--bpm',80)
for tr,wave,gain in [('depth','sine',-21),('signal','triangle',-27)]:
 run('music',cfg,'define-track','--name',tr,'--instrument',wave);run('music',cfg,'set-track-fx','--track',tr,'--gain',gain,'--reverb',0.4)
for bar,pitch in enumerate([33,33,29,31]):
 run('music',cfg,'add-note','--track','depth','--pitch',pitch,'--t',bar*8,'--dur',8,'--velocity',62)
 for j,p in enumerate([0,7,12,15]):run('music',cfg,'add-note','--track','signal','--pitch',pitch+24+p,'--t',bar*8+j*2,'--dur',1.5,'--velocity',40)
run('music',cfg,'render')
