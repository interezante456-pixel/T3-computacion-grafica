"""Generador de modelos 3D en formato GLB para el videojuego Operación Extracción FPS.
Computación Gráfica y Visual - UPN

Genera modelos GLB originales:
1. pistola.glb        - Arma secundaria ligera táctica
2. rifle.glb          - Arma principal rifle de asalto pesado
3. zombie.glb         - Enemigo infectado humanoide
4. caja_municion.glb  - Objeto coleccionable de abastecimiento

Dependencias para regenerar (opcional):
    pip install trimesh numpy
    python tools/generar_modelos.py
"""
from pathlib import Path
import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix

OUT = Path(__file__).resolve().parent.parent / 'models'
OUT.mkdir(parents=True, exist_ok=True)

COLORS = {
    'gun_metal': (42, 45, 52, 255),
    'gun_dark': (25, 27, 31, 255),
    'gun_steel': (80, 85, 95, 255),
    'gold_brass': (212, 168, 67, 255),
    'laser_green': (50, 255, 120, 255),
    'sight_red': (255, 45, 45, 255),
    'olive_military': (68, 76, 56, 255),
    'yellow_hazard': (235, 185, 30, 255),
    'zombie_skin': (78, 102, 73, 255),
    'zombie_skin_dark': (55, 75, 50, 255),
    'zombie_clothes': (48, 52, 63, 255),
    'zombie_pants': (60, 48, 38, 255),
    'zombie_blood': (140, 20, 20, 255),
    'eye_glow': (255, 30, 0, 255),
}

def art(name):
    return trimesh.Scene(base_frame=name)

def add_geom(scene, mesh, color='gun_metal', name='pieza', metal=0.7, rough=0.35):
    color_factor = COLORS.get(color, (180, 180, 180, 255))
    mat = trimesh.visual.material.PBRMaterial(
        name=f'{name}_{color}',
        baseColorFactor=color_factor,
        metallicFactor=metal,
        roughnessFactor=rough
    )
    mesh.visual = trimesh.visual.TextureVisuals(material=mat)
    scene.add_geometry(mesh, node_name=name)

def box(scene, name, center, size, color, metal=0.7, rough=0.35):
    mesh = trimesh.creation.box(extents=size)
    mesh.apply_translation(center)
    add_geom(scene, mesh, color, name, metal, rough)

def cyl(scene, name, center, radius, height, color='gun_metal', axis='y', metal=0.7, rough=0.35):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=24)
    if axis == 'x':
        mesh.apply_transform(rotation_matrix(np.pi / 2, [0, 0, 1]))
    elif axis == 'z':
        mesh.apply_transform(rotation_matrix(np.pi / 2, [1, 0, 0]))
    mesh.apply_translation(center)
    add_geom(scene, mesh, color, name, metal, rough)

# -------------------------------------------------------------
# 1. PISTOLA TÁCTICA 9MM
# -------------------------------------------------------------
def generar_pistola():
    s = art('Pistola Tactica 9mm')
    # Corredera superior (apuntando hacia -Z)
    box(s, 'corredera', (0, 0.12, -0.08), (0.05, 0.06, 0.32), 'gun_steel', 0.85, 0.25)
    # Cañón interior
    cyl(s, 'canon', (0, 0.12, -0.25), 0.016, 0.08, 'gun_dark', axis='z', metal=0.9, rough=0.2)
    # Bocacha / orificio
    cyl(s, 'bocacha', (0, 0.12, -0.29), 0.01, 0.02, 'gun_dark', axis='z', metal=0.95, rough=0.1)
    # Armazón inferior
    box(s, 'armazon', (0, 0.06, -0.06), (0.046, 0.05, 0.28), 'gun_metal', 0.6, 0.4)
    # Empuñadura ergonómica
    empunadura = trimesh.creation.box(extents=(0.044, 0.18, 0.075))
    empunadura.apply_transform(rotation_matrix(np.radians(16), [1, 0, 0]))
    empunadura.apply_translation((0, -0.04, 0.06))
    add_geom(s, empunadura, 'gun_dark', 'empunadura', 0.2, 0.8)
    # Guardamonte
    box(s, 'guardamonte_inf', (0, -0.02, -0.04), (0.02, 0.012, 0.09), 'gun_metal', 0.8, 0.3)
    box(s, 'guardamonte_ant', (0, 0.01, -0.085), (0.02, 0.06, 0.012), 'gun_metal', 0.8, 0.3)
    # Gatillo
    box(s, 'gatillo', (0, 0.015, -0.04), (0.012, 0.035, 0.015), 'gun_steel', 0.9, 0.2)
    # Miras (alza trasera y punto delantero con brillo)
    box(s, 'alza_trasera', (0, 0.16, 0.06), (0.032, 0.02, 0.02), 'gun_metal', 0.7, 0.3)
    box(s, 'mira_delantera', (0, 0.16, -0.22), (0.012, 0.02, 0.015), 'laser_green', 0.1, 0.1)
    return s

# -------------------------------------------------------------
# 2. RIFLE DE ASALTO TÁCTICO M4
# -------------------------------------------------------------
def generar_rifle():
    s = art('Rifle de Asalto Tactico')
    # Cajón de mecanismos central
    box(s, 'cajon_superior', (0, 0.10, -0.05), (0.06, 0.08, 0.38), 'gun_metal', 0.8, 0.3)
    box(s, 'cajon_inferior', (0, 0.03, -0.05), (0.056, 0.06, 0.32), 'gun_dark', 0.7, 0.4)
    # Guardamanos frontal
    box(s, 'guardamanos', (0, 0.10, -0.38), (0.064, 0.075, 0.32), 'gun_dark', 0.5, 0.5)
    # Cañón largo sobresaliendo
    cyl(s, 'canon_largo', (0, 0.10, -0.62), 0.018, 0.22, 'gun_steel', axis='z', metal=0.9, rough=0.2)
    # Freno de boca / silenciador
    cyl(s, 'freno_boca', (0, 0.10, -0.74), 0.024, 0.06, 'gun_dark', axis='z', metal=0.95, rough=0.2)
    # Riel Picatinny superior
    box(s, 'riel_superior', (0, 0.15, -0.15), (0.038, 0.018, 0.50), 'gun_steel', 0.85, 0.2)
    # Mira Holográfica / Red Dot
    box(s, 'montura_mira', (0, 0.17, -0.08), (0.045, 0.025, 0.12), 'gun_dark', 0.7, 0.3)
    box(s, 'marco_mira', (0, 0.21, -0.08), (0.05, 0.06, 0.14), 'gun_metal', 0.8, 0.3)
    box(s, 'cristal_mira', (0, 0.21, -0.08), (0.036, 0.044, 0.01), 'sight_red', 0.1, 0.1)
    # Cargador curvo táctico
    cargador = trimesh.creation.box(extents=(0.036, 0.24, 0.09))
    cargador.apply_transform(rotation_matrix(np.radians(14), [1, 0, 0]))
    cargador.apply_translation((0, -0.11, -0.12))
    add_geom(s, cargador, 'gun_dark', 'cargador', 0.6, 0.4)
    # Culata trasera
    box(s, 'tubo_culata', (0, 0.09, 0.22), (0.035, 0.035, 0.20), 'gun_steel', 0.85, 0.2)
    box(s, 'apoyo_culata', (0, 0.06, 0.33), (0.05, 0.16, 0.07), 'gun_dark', 0.3, 0.7)
    # Empuñadura de pistola
    emp = trimesh.creation.box(extents=(0.042, 0.19, 0.075))
    emp.apply_transform(rotation_matrix(np.radians(22), [1, 0, 0]))
    emp.apply_translation((0, -0.07, 0.07))
    add_geom(s, emp, 'gun_dark', 'empunadura_rifle', 0.3, 0.7)
    return s

# -------------------------------------------------------------
# 3. ZOMBI INFECTADO (HUMANOIDE 3D)
# -------------------------------------------------------------
def generar_zombie():
    s = art('Zombi Infectado')
    # Cabeza desfigurada con ojos brillantes
    box(s, 'cabeza', (0, 1.65, 0), (0.28, 0.32, 0.28), 'zombie_skin', 0.1, 0.8)
    box(s, 'mandibula', (0, 1.52, 0.06), (0.24, 0.10, 0.18), 'zombie_skin_dark', 0.1, 0.9)
    # Ojos brillantes rojos / infectados
    box(s, 'ojo_izq', (-0.08, 1.68, 0.14), (0.05, 0.05, 0.02), 'eye_glow', 0.0, 0.1)
    box(s, 'ojo_der', (0.08, 1.68, 0.14), (0.05, 0.05, 0.02), 'eye_glow', 0.0, 0.1)
    # Torso con manchas de sangre
    box(s, 'torso', (0, 1.15, 0), (0.50, 0.65, 0.30), 'zombie_clothes', 0.1, 0.85)
    box(s, 'sangre_pecho', (0.06, 1.18, 0.155), (0.22, 0.25, 0.01), 'zombie_blood', 0.1, 0.3)
    # Cinturón / cintura
    box(s, 'cintura', (0, 0.80, 0), (0.46, 0.12, 0.28), 'zombie_skin_dark', 0.1, 0.9)
    # Brazos extendidos hacia adelante (postura clásica de ataque zombi apuntando a +Z)
    # Brazo izquierdo
    box(s, 'brazo_izq', (-0.35, 1.30, 0.32), (0.13, 0.13, 0.65), 'zombie_clothes', 0.1, 0.8)
    box(s, 'mano_izq', (-0.35, 1.30, 0.68), (0.11, 0.11, 0.14), 'zombie_skin', 0.1, 0.7)
    # Brazo derecho un poco asimétrico/fracturado
    box(s, 'brazo_der', (0.35, 1.25, 0.30), (0.13, 0.13, 0.62), 'zombie_skin', 0.1, 0.8)
    box(s, 'mano_der', (0.35, 1.25, 0.64), (0.11, 0.11, 0.14), 'zombie_skin_dark', 0.1, 0.7)
    # Piernas
    # Pierna izquierda
    box(s, 'pierna_izq', (-0.15, 0.40, 0), (0.18, 0.75, 0.20), 'zombie_pants', 0.1, 0.9)
    box(s, 'pie_izq', (-0.15, 0.05, 0.06), (0.19, 0.10, 0.28), 'zombie_clothes', 0.2, 0.8)
    # Pierna derecha
    box(s, 'pierna_der', (0.15, 0.40, 0), (0.18, 0.75, 0.20), 'zombie_pants', 0.1, 0.9)
    box(s, 'pie_der', (0.15, 0.05, 0.06), (0.19, 0.10, 0.28), 'zombie_clothes', 0.2, 0.8)
    return s

# -------------------------------------------------------------
# 4. CAJA DE MUNICIONES TÁCTICA
# -------------------------------------------------------------
def generar_caja_municion():
    s = art('Caja de Municiones')
    # Cuerpo militar verde oliva
    box(s, 'caja_base', (0, 0.22, 0), (0.55, 0.36, 0.35), 'olive_military', 0.4, 0.6)
    # Tapa reforzada
    box(s, 'tapa', (0, 0.42, 0), (0.58, 0.06, 0.38), 'olive_military', 0.5, 0.5)
    # Franjas amarillas de advertencia / peligro
    box(s, 'franja_amarilla', (0, 0.22, 0.18), (0.42, 0.10, 0.01), 'yellow_hazard', 0.2, 0.4)
    # Manija superior metálica
    box(s, 'asa_soporte_izq', (-0.12, 0.47, 0), (0.03, 0.05, 0.03), 'gun_steel', 0.85, 0.2)
    box(s, 'asa_soporte_der', (0.12, 0.47, 0), (0.03, 0.05, 0.03), 'gun_steel', 0.85, 0.2)
    box(s, 'asa_barra', (0, 0.50, 0), (0.26, 0.025, 0.03), 'gun_steel', 0.85, 0.2)
    # Cierres metálicos laterales
    box(s, 'cierre_izq', (-0.18, 0.36, 0.18), (0.04, 0.09, 0.02), 'gold_brass', 0.9, 0.2)
    box(s, 'cierre_der', (0.18, 0.36, 0.18), (0.04, 0.09, 0.02), 'gold_brass', 0.9, 0.2)
    return s

# -------------------------------------------------------------
# EXPORTACIÓN DE LOS 4 MODELOS GLB
# -------------------------------------------------------------
def main():
    generadores = [
        ('pistola.glb', generar_pistola),
        ('rifle.glb', generar_rifle),
        ('zombie.glb', generar_zombie),
        ('caja_municion.glb', generar_caja_municion),
    ]

    print("Iniciando generacion de modelos GLB...")
    for archivo, funcion in generadores:
        escena = funcion()
        destino = OUT / archivo
        glb_data = trimesh.exchange.gltf.export_glb(escena)
        destino.write_bytes(glb_data)
        print(f" -> {archivo}: generado con exito ({len(glb_data) / 1024:.1f} KB, {len(escena.geometry)} mallas)")

if __name__ == '__main__':
    main()
