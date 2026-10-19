import { createCipheriv } from "node:crypto";
import type { FieldCipher } from "../crypto";

/**
 * The secret rotation a person's memory vectors are stored under
 * (DECISIONS 114).
 *
 * A vector sealed like the words could not be searched by the database, and
 * a provider's vector stored as it came is close enough to the words to be
 * read back by an inversion model trained on that provider. A rotation sits
 * between the two: it keeps every angle between one person's vectors (so
 * pgvector's cosine distance finds the same neighbours) and moves all of
 * them to a place that only the person's key describes. A query is turned
 * the same way before it is compared.
 *
 * The rotation is a random orthogonal matrix in the sense of Stewart
 * (1980): a product of n - 1 Householder reflections with Gaussian
 * directions on shrinking subspaces, after a random change of signs. Its
 * randomness is AES-256-CTR keyed by a key derived from the person's data
 * key, so it is never stored: it is drawn again, the same, whenever it is
 * needed, and it dies with the data key. Drawing it costs about n * n / 2
 * Gaussian numbers (some 20 ms for 1536 dimensions); turning a vector,
 * about 2 * n * n operations.
 *
 * It is not encryption: anyone holding the rows sees how alike two of a
 * person's memories are. DECISIONS 114 says what a dump does and does not
 * reveal.
 */
export interface Rotation {
  readonly dimensions: number;
  /** Each vector scaled to length 1, then turned. Vectors of another length are refused. */
  turn(vectors: readonly (readonly number[])[]): number[][];
}

const TWO_POW_32 = 4_294_967_296;
const TWO_PI = 2 * Math.PI;

/** Keystream words: n sign words, then two words per pair of Gaussian numbers of each reflection. */
function streamWords(n: number): number {
  let words = n;
  for (let m = 2; m <= n; m += 1) words += Math.ceil(m / 2) * 2;
  return words;
}

/** The whole keystream at once, as 32-bit words (little-endian, as the bytes come). */
function keystream(seed: Buffer, words: number): Uint32Array {
  const bytes = createCipheriv("aes-256-ctr", seed, Buffer.alloc(16)).update(Buffer.alloc(words * 4));
  const out = new Uint32Array(words);
  for (let i = 0; i < words; i += 1) out[i] = bytes.readUInt32LE(i * 4);
  return out;
}

/** `count` standard normal numbers into `out`, by Box and Muller, from `words` at `at`. Returns the next word. */
function normals(words: Uint32Array, at: number, out: Float64Array, count: number): number {
  let w = at;
  for (let i = 0; i < count; i += 2) {
    // In (0, 1), never 0, so the logarithm is finite.
    const u1 = (words[w]! + 0.5) / TWO_POW_32;
    const u2 = (words[w + 1]! + 0.5) / TWO_POW_32;
    w += 2;
    const radius = Math.sqrt(-2 * Math.log(u1));
    out[i] = radius * Math.cos(TWO_PI * u2);
    if (i + 1 < count) out[i + 1] = radius * Math.sin(TWO_PI * u2);
  }
  return w;
}

function unit(vector: readonly number[]): Float64Array {
  let sum = 0;
  for (const value of vector) {
    if (!Number.isFinite(value)) throw new RangeError("a vector holds a value that is not a number");
    sum += value * value;
  }
  const length = Math.sqrt(sum);
  if (length === 0) throw new RangeError("a vector of length zero has no direction");
  return Float64Array.from(vector, (value) => value / length);
}

/** The rotation drawn from `seed` (32 bytes) for vectors of `dimensions`. */
export function createRotation(seed: Buffer, dimensions: number): Rotation {
  if (seed.byteLength !== 32) throw new RangeError("a rotation needs a 32-byte seed");
  if (!Number.isInteger(dimensions) || dimensions < 2 || dimensions > 16_000) {
    throw new RangeError("a rotation needs 2 to 16000 dimensions");
  }
  const n = dimensions;
  return {
    dimensions: n,
    turn(vectors) {
      const rows = vectors.map((vector) => {
        if (vector.length !== n) throw new RangeError(`a vector of ${vector.length} values, not ${n}`);
        return unit(vector);
      });
      if (rows.length === 0) return [];
      // One keystream per call, read in the same order every time: the same rotation.
      const words = keystream(seed, streamWords(n));
      for (const row of rows) {
        for (let i = 0; i < n; i += 1) if (words[i]! & 1) row[i] = -row[i]!;
      }
      let at = n;
      const buffer = new Float64Array(n);
      // Q = H(0) H(1) ... H(n-2) S: the reflection on the smallest subspace acts first.
      for (let k = n - 2; k >= 0; k -= 1) {
        const m = n - k;
        const direction = buffer.subarray(0, m);
        at = normals(words, at, direction, m);
        let norm = 0;
        for (let i = 0; i < m; i += 1) norm += direction[i]! * direction[i]!;
        norm = Math.sqrt(norm);
        // Reflect x onto -sign(x0) |x| e1, the stable choice; u = x + sign(x0) |x| e1, scaled to length 1.
        direction[0] = direction[0]! + (direction[0]! >= 0 ? norm : -norm);
        let length = 0;
        for (let i = 0; i < m; i += 1) length += direction[i]! * direction[i]!;
        length = Math.sqrt(length);
        if (length === 0) continue;
        for (let i = 0; i < m; i += 1) direction[i] = direction[i]! / length;
        for (const row of rows) {
          let dot = 0;
          for (let i = 0; i < m; i += 1) dot += direction[i]! * row[k + i]!;
          const twice = 2 * dot;
          for (let i = 0; i < m; i += 1) row[k + i] = row[k + i]! - twice * direction[i]!;
        }
      }
      return rows.map((row) => Array.from(row));
    },
  };
}

/** The person's rotation for vectors of this length: derived from their data key, never stored. */
export function rotationFor(cipher: FieldCipher, dimensions: number): Rotation {
  return createRotation(cipher.deriveKey(`memories.embedding/rotation/${dimensions}`), dimensions);
}
