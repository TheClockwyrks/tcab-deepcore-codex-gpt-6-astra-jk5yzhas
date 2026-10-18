"""Final authored audio layering and particle dynamics."""
import json,subprocess

def run(tool,cfg,*args):subprocess.run([tool,'--config',cfg,*map(str,args)],check=True,stdout=subprocess.DEVNULL)
for name,sample,pitch in [('impact','impact_metal_hollow',-4),('gas-explosion','cannon_body_heavy',-5),('ore-pickup','mech_clip_load',9),('fabricate','mech_ratchet',3),('launch','boom_sub_rumble',-2),('death','debris_rubble',-6)]:
 cfg=f'art-source/{name}.audio.json';run('sfx-sample',cfg,'add-sample','--name',sample,'--t',0,'--gain',-16,'--pitch',pitch,'--trim','0,650','--fade-out',160);run('sfx-sample',cfg,'render')
for name,cut in [('drill',1800),('thrust',650),('lava-sizzle',3200)]:
 cfg=f'art-source/{name}.audio.json';run('sfx-synth',cfg,'add-filter','--voice','body','--type','lowpass','--cutoff',cut);run('sfx-sample',cfg,'render')
for name in ['ore-pickup','material-chime','alarm-fuel','alarm-core']:
 cfg=f'art-source/{name}.audio.json';run('sfx-synth',cfg,'set-envelope','--voice','body','--env','pluck');run('sfx-synth',cfg,'set-envelope','--voice','metal','--env','pluck');run('sfx-sample',cfg,'render')
cfg='art-source/music.config.json';run('music',cfg,'define-track','--name','signal','--instrument','vibraphone');run('music',cfg,'define-track','--name','atmosphere','--instrument','synth_pad');run('music',cfg,'set-track-fx','--track','atmosphere','--gain',-30,'--reverb',0.6,'--env','swell')
for i,p in enumerate([57,53,55,52]):run('music',cfg,'add-note','--track','atmosphere','--pitch',p,'--t',i*8,'--dur',8,'--velocity',55)
run('music',cfg,'render')
for name in ['drill-debris','impact-dust','gas-explosion','core-detonation','death-burst']:
 cfg=f'art-source/{name}.config.json';run('particle-2d',cfg,'set-forces','--gravity',-90,'--radial',60,'--drag',1,'--turbulence','18,0.04')
 if name in ['gas-explosion','core-detonation']:
  run('particle-2d',cfg,'add-emitter','--name','shockwave','--shape','disc','--radius',1,'--x',128,'--y',128,'--burst',80,'--lifetime',350,'--speed',360,'--cone-angle',180)
  run('particle-2d',cfg,'set-particle','--emitter','shockwave','--size-from',.45,'--size-to',1.5,'--opacity-from',.8,'--opacity-to',0,'--color-gradient','#ffe8ad@0,#da8c71@1')
 if name=='drill-debris':run('particle-2d',cfg,'set-particle','--emitter','chips','--size-from',.35,'--size-to',.1,'--opacity-from',.65,'--color-gradient','#bc9c75@0,#6b6161@1')
 run('particle-2d',cfg,'render','--frame',12)
