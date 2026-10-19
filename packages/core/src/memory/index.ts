/**
 * The memory's own pieces in core: the rotation its vectors are stored
 * under, and the worker's list of who has something to read. The
 * repository is `scope.memories`.
 */
export { createRotation, rotationFor, type Rotation } from "./rotation";
export { memoryWork } from "./work";
