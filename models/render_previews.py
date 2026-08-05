"""Render preview of all generated models."""
import bpy
import sys

models = [
    ('helmet_junk_hod', 'Скорбный капюшон'),
    ('weapon_junk_sword', 'Стон могильщика'),
    ('shield_junk_coffin', 'Гробовая преграда'),
]

base = '/mnt/c/project/game/models/output'

for fname, title in models:
    bpy.ops.wm.open_mainfile(filepath=f'{base}/{fname}.blend')
    
    # Set camera as active
    for obj in bpy.data.objects:
        if obj.type == 'CAMERA':
            bpy.context.scene.camera = obj
            break
    
    bpy.context.scene.render.filepath = f'{base}/preview_{fname}_'
    bpy.context.scene.render.resolution_x = 512
    bpy.context.scene.render.resolution_y = 512
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {title} -> preview_{fname}_.png")

print("ALL DONE")
