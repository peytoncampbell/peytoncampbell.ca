import * as THREE from 'three'
import { clampWaterPoint } from './world'

interface FishMeshRegistration {
  mesh: THREE.InstancedMesh
  fishIds: string[]
}

class SceneBridge {
  camera: THREE.Camera | null = null
  gl: THREE.WebGLRenderer | null = null
  private fishMeshes: FishMeshRegistration[] = []
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private hitPoint = new THREE.Vector3()

  orbit: ((dx: number, dy: number) => void) | null = null
  zoom: ((delta: number) => void) | null = null
  resetView: (() => void) | null = null

  registerFishMesh(mesh: THREE.InstancedMesh, fishIds: string[]): () => void {
    const entry: FishMeshRegistration = { mesh, fishIds }
    this.fishMeshes.push(entry)
    return () => {
      this.fishMeshes = this.fishMeshes.filter((candidate) => candidate !== entry)
    }
  }

  private setRay(clientX: number, clientY: number, rect: DOMRect): void {
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    if (!this.camera) return
    this.raycaster.setFromCamera(this.pointer, this.camera)
  }

  pickFish(clientX: number, clientY: number, rect: DOMRect): string | null {
    if (!this.camera) return null
    this.setRay(clientX, clientY, rect)
    const meshes = this.fishMeshes.map((entry) => entry.mesh)
    if (meshes.length === 0) return null
    const hits = this.raycaster.intersectObjects(meshes, false)
    for (const hit of hits) {
      if (hit.instanceId === undefined) continue
      const registration = this.fishMeshes.find((entry) => entry.mesh === hit.object)
      const fishId = registration?.fishIds[hit.instanceId]
      if (fishId) return fishId
    }
    return null
  }

  pickWater(clientX: number, clientY: number, rect: DOMRect): THREE.Vector3 | null {
    if (!this.camera) return null
    this.setRay(clientX, clientY, rect)
    const point = this.raycaster.ray.intersectPlane(this.waterPlane, this.hitPoint)
    if (!point) return null
    return clampWaterPoint(point.clone())
  }

  capture(): string | null {
    if (!this.gl) return null
    return this.gl.domElement.toDataURL('image/png')
  }
}

export const sceneBridge = new SceneBridge()
