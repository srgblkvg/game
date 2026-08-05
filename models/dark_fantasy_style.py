"""
Dark Fantasy style module for MMO Arena equipment.
Provides shared materials, lighting, and helpers for consistent aesthetic.
"""
import bpy
import math


# ── Color palette (dark fantasy junk tier) ──

COLORS = {
    "rust_iron":     (0.18, 0.10, 0.06, 1.0),   # dark rusty metal
    "old_bone":      (0.55, 0.50, 0.40, 1.0),   # aged bone
    "rotten_wood":   (0.15, 0.10, 0.05, 1.0),   # dark decayed wood
    "torn_cloth":    (0.20, 0.18, 0.15, 1.0),   # dirty gray cloth
    "dried_blood":   (0.25, 0.05, 0.03, 1.0),   # dark dried blood
    "tarnished_iron":(0.25, 0.22, 0.18, 1.0),   # dull tarnished metal
    "grave_dirt":    (0.12, 0.09, 0.06, 1.0),   # grave soil
}


def make_material(name, color, roughness=0.85, metallic=0.0):
    """Create a PBR material for dark fantasy style."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.location = (0, 0)
    
    out = nodes.new(type='ShaderNodeOutputMaterial')
    out.location = (300, 0)
    mat.node_tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    
    return mat


def setup_scene():
    """Standard dark fantasy scene setup."""
    # Clear existing
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Camera
    bpy.ops.object.camera_add(location=(0, -3, 1.5))
    cam = bpy.context.object
    cam.rotation_euler = (math.radians(75), 0, 0)
    bpy.context.scene.camera = cam
    
    # Lighting - dim, moody
    bpy.ops.object.light_add(type='SUN', location=(5, -5, 8))
    sun = bpy.context.object
    sun.data.energy = 3
    sun.data.color = (0.9, 0.85, 0.7)  # pale sickly light
    
    bpy.ops.object.light_add(type='POINT', location=(-3, -2, 1))
    fill = bpy.context.object
    fill.data.energy = 50
    fill.data.color = (0.4, 0.3, 0.5)  # cold purple fill
    
    # World - dark void
    world = bpy.data.worlds.new("DarkWorld")
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.02, 0.03, 1.0)
    bpy.context.scene.world = world


def center_and_export(filepath):
    """Frame the model, apply transforms, and save."""
    bpy.ops.object.select_all(action='SELECT')
    if bpy.context.selected_objects:
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='MEDIAN')
        for obj in bpy.context.selected_objects:
            obj.location = (0, 0, 0)
    
    bpy.ops.wm.save_as_mainfile(filepath=filepath)
    print(f"Saved: {filepath}")


def export_glb(filepath):
    """Export as glTF binary for web use."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        export_apply=True,
    )
    print(f"Exported GLB: {filepath}")
