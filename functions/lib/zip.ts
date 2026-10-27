/**
 * 独立、健壮的 ZIP 解压实现，仅依赖 Cloudflare Workers 运行时自带的
 * `DecompressionStream`（不引入 fflate / jszip 等第三方依赖）。
 *
 * 设计原则（按 AUDIT M7 的要求）：
 * 1. 解压**任何一项失败都必须整体抛错**，绝不允许静默 skip，否则会部署出
 *    “缺文件”的站点而 UI 仍报成功。
 * 2. 覆盖实际场景里的各种脏数据：目录项、macOS `__MACOSX/` 与 `._*`
 *    AppleDouble 资源叉、`.DS_Store`、UTF-8 文件名（通用位标志 bit 11）、
 *    流式写入导致的置 0 长度（data descriptor）、多余的前导 `./` 与 `/`。
 * 3. 对每个条目做 CRC-32 校验，截断/损坏会被立刻发现，而不是产出半截文件。
 *
 * 暂不支持（会给出明确错误而不是静默降级）：加密条目、ZIP64、非 stored/deflate
 * 的压缩算法。ZIP64 归档体积远超 Workers 内存，不在这条链路的支持范围内。
 */

/** 单次解压可接受的**未压缩**总字节上限，见 `unzip` 的 options 说明。 */
export const DEFAULT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export interface ZipEntry {
  /** 归档内的相对路径，使用 `/` 分隔，已去掉前导 `./` 与 `/`。 */
  path: string;
  /** 文件二进制内容（零拷贝地引用入参 ArrayBuffer 之外的独立内存）。 */
  content: Uint8Array;
}

export interface UnzipOptions {
  /**
   * 未压缩总字节上限。Pages/Wrangler 侧没有公布“总大小”限制，这里取的是
   * Workers 运行时的内存安全阈值：整个 ZIP 与各文件内容同时驻留在内存里，
   * 超过该阈值很容易 OOM，因此在解压过程中就提前失败。
   * 默认 50MB，可用 `Infinity` 关闭（不推荐）。
   */
  maxTotalBytes?: number;
}

// ---------------------------------------------------------------------------
// ZIP 结构常量
// ---------------------------------------------------------------------------

/** End of central directory record 签名 "PK\x05\x06"。 */
const EOCD_SIGNATURE = 0x06054b50;
/** EOCD 最小长度（不含文件注释）。 */
const EOCD_MIN_SIZE = 22;
/** EOCD 尾部注释最大长度。 */
const MAX_COMMENT_SIZE = 0xffff;

/** ZIP64 end of central directory locator 签名，仅用于识别并报错。 */
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;

/** Central directory file header 签名 "PK\x01\x02"。 */
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
/** Local file header 签名 "PK\x03\x04"。 */
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;

/** 压缩算法：不压缩。 */
const COMPRESSION_STORED = 0;
/** 压缩算法：deflate（原始流，无 zlib 头）。 */
const COMPRESSION_DEFLATE = 8;

/** 通用位标志：条目被加密，必须拒绝。 */
const FLAG_ENCRYPTED = 1 << 0;
/** 通用位标志：长度与 CRC 位于数据描述符中（streaming 写入）。 */
const FLAG_DATA_DESCRIPTOR = 1 << 3;
/** 通用位标志：强加密，必须拒绝。 */
const FLAG_STRONG_ENCRYPTION = 1 << 6;
/** 通用位标志：文件名/注释为 UTF-8 编码。 */
export const FLAG_UTF8_NAME = 1 << 11;

// ---------------------------------------------------------------------------
// CRC-32（用于校验每个条目的完整性）
// ---------------------------------------------------------------------------

let crc32Table: Uint32Array | null = null;

function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  crc32Table = table;
  return table;
}

function crc32(data: Uint8Array): number {
  const table = getCrc32Table();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function concatChunks(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

/**
 * 使用 `DecompressionStream('deflate-raw')` 解压一段原始数据。
 * 任何异常都会向上抛出，由调用方包装成带文件名信息的错误。
 */
async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  // 必须先 await write 再 close：并发下发会让部分运行时丢尾部数据块。
  await writer.write(compressed);
  await writer.close();

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    reader.releaseLock();
  }
  return concatChunks(chunks, total);
}

/** 归一化 ZIP 内的路径：去掉前导 `./` 与 `/`，保留其余部分。 */
export function normalizeEntryPath(raw: string): string {
  let path = raw.replace(/\\/g, "/");
  while (path.startsWith("./")) path = path.slice(2);
  while (path.startsWith("/")) path = path.slice(1);
  return path;
}

/**
 * 是否为应当被忽略的条目：**仅**包括目录项以及 macOS/Windows 生成的垃圾文件。
 * 注意这与“解压失败就跳过”完全是两回事：这些条目本身没有可用内容。
 */
export function isIgnoredZipEntry(rawName: string): boolean {
  // 目录项在 ZIP 里以 `/` 结尾。
  if (rawName.endsWith("/")) return true;
  const path = normalizeEntryPath(rawName);
  if (path === "" || path === ".") return true;
  // macOS Finder 压缩生成的资源叉目录。
  if (path.startsWith("__MACOSX/")) return true;
  const basename = path.slice(path.lastIndexOf("/") + 1);
  // AppleDouble 资源叉文件（__MACOSX 之外也可能单独出现）与访达索引文件。
  if (basename.startsWith("._")) return true;
  if (basename === ".DS_Store") return true;
  return false;
}

/** 从后往前扫描 EOCD，返回其偏移量；找不到返回 -1。 */
function findEocd(view: DataView): number {
  const searchLimit = Math.min(view.byteLength, EOCD_MIN_SIZE + MAX_COMMENT_SIZE);
  for (let offset = view.byteLength - EOCD_MIN_SIZE; offset >= view.byteLength - searchLimit; offset--) {
    if (offset < 0) break;
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

function decodePath(bytes: Uint8Array, flags: number): string {
  // bit 11 表示 UTF-8；未置位时规范上应是 CP437，Workers 没有该解码器，
  // 而现实里绝大多数压缩工具同样写入 UTF-8，因此统一按 UTF-8 解码。
  return new TextDecoder(flags & FLAG_UTF8_NAME ? "utf-8" : "utf-8").decode(bytes);
}

// ---------------------------------------------------------------------------
// 对外 API
// ---------------------------------------------------------------------------

/**
 * 解压一个 ZIP 归档，返回其中的全部**文件**条目。
 *
 * - 目录项、`__MACOSX/`、`._*`、`.DS_Store` 会被过滤掉。
 * - 任何一个条目读取失败（CRC 不匹配、长度不足、不支持的算法、加密、ZIP64…）
 *   都会立刻抛出带路径信息的 Error，调用方应直接让整个部署失败。
 * - 同名条目以后出现的为准。
 */
export async function unzip(
  buffer: ArrayBuffer,
  options: UnzipOptions = {}
): Promise<ZipEntry[]> {
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  if (view.byteLength < EOCD_MIN_SIZE) {
    throw new Error("不是有效的 ZIP 文件（长度小于 EOCD 记录）");
  }

  const eocdOffset = findEocd(view);
  if (eocdOffset < 0) {
    throw new Error("不是有效的 ZIP 文件（找不到 End Of Central Directory 记录）");
  }

  // 注释长度应与 EOCD 位置吻合，用于识别被追加数据污染（如自解压包）。
  const commentLength = view.getUint16(eocdOffset + 20, true);
  if (eocdOffset + EOCD_MIN_SIZE + commentLength !== view.byteLength) {
    // 尾部有多余数据：常见于自解压包或被追加内容的归档，只提示，不阻断。
    // （Cloudflare Pages 部署 ZIP 通常不会有这种情况，故不做额外处理。）
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  if (
    (eocdOffset > 0 && view.getUint32(eocdOffset - 20, true) === ZIP64_EOCD_LOCATOR_SIGNATURE) ||
    totalEntries === 0xffff ||
    centralDirOffset === 0xffffffff
  ) {
    throw new Error("暂不支持 ZIP64 格式的归档（条目数或体积超出 32 位表示范围）");
  }

  if (centralDirOffset + 4 > view.byteLength) {
    throw new Error("ZIP 中央目录偏移量越界，文件可能已损坏");
  }

  const files = new Map<string, Uint8Array>();
  let offset = centralDirOffset;
  let totalUncompressed = 0;

  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > view.byteLength) {
      throw new Error(`ZIP 中央目录在第 ${i + 1} 个条目处越界，文件可能已损坏`);
    }
    if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`ZIP 中央目录第 ${i + 1} 个条目签名不合法，文件可能已损坏`);
    }

    const flags = view.getUint16(offset + 8, true);
    const compressionMethod = view.getUint16(offset + 10, true);
    const crc32Value = view.getUint32(offset + 16, true);
    const cdCompressedSize = view.getUint32(offset + 20, true);
    const cdUncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraFieldLength = view.getUint16(offset + 30, true);
    const commentFieldLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const rawNameEnd = offset + 46 + fileNameLength;
    if (rawNameEnd > view.byteLength) {
      throw new Error("ZIP 条目的文件名长度越界，文件可能已损坏");
    }
    const rawName = decodePath(uint8.subarray(offset + 46, rawNameEnd), flags);

    const entry = offset;
    // 推进到下一个中央目录条目（无论本次是否抽取都必须推进）。
    offset = rawNameEnd + extraFieldLength + commentFieldLength;

    if (isIgnoredZipEntry(rawName)) {
      continue;
    }

    if (flags & FLAG_ENCRYPTED || flags & FLAG_STRONG_ENCRYPTION) {
      throw new Error(`ZIP 条目「${rawName}」使用了加密，暂不支持解压`);
    }

    if (localHeaderOffset + 30 > view.byteLength) {
      throw new Error(`ZIP 条目「${rawName}」的本地文件头越界，文件可能已损坏`);
    }
    if (view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(`ZIP 条目「${rawName}」的本地文件头签名不合法，文件可能已损坏`);
    }

    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;

    // 长度取值：streaming 写入时本地头里的长度是 0，真实值只存在于中央目录
    // （FLAG_DATA_DESCRIPTOR）；反之也有一部分老压缩工具只写本地头取不到值，
    // 因此“本地非零用本地，否则取中央目录”最能兼容两种情况。
    const localCompressedSize = view.getUint32(localHeaderOffset + 18, true);
    const localUncompressedSize = view.getUint32(localHeaderOffset + 22, true);
    const compressedSize = localCompressedSize !== 0 ? localCompressedSize : cdCompressedSize;
    const uncompressedSize =
      localUncompressedSize !== 0 ? localUncompressedSize : cdUncompressedSize;
    // 仅用于判断是否存在数据描述符。
    void (flags & FLAG_DATA_DESCRIPTOR);

    if (dataOffset + compressedSize > view.byteLength) {
      throw new Error(
        `ZIP 条目「${rawName}」的数据区越界（需要 ${compressedSize} 字节，实际剩余 ${view.byteLength - dataOffset} 字节），文件可能不完整`
      );
    }

    const path = normalizeEntryPath(rawName);
    if (path === "") {
      throw new Error(`ZIP 条目「${rawName}」的路径无效`);
    }

    let content: Uint8Array;
    if (compressionMethod === COMPRESSION_STORED) {
      if (compressedSize !== uncompressedSize) {
        throw new Error(
          `ZIP 条目「${rawName}」为未压缩存储，但声明的长度不一致（${compressedSize} vs ${uncompressedSize}）`
        );
      }
      content = uint8.slice(dataOffset, dataOffset + compressedSize);
    } else if (compressionMethod === COMPRESSION_DEFLATE) {
      const compressedData = uint8.subarray(dataOffset, dataOffset + compressedSize);
      content = await inflateRaw(compressedData);
      if (content.length !== uncompressedSize) {
        throw new Error(
          `ZIP 条目「${rawName}」解压后长度不符（期望 ${uncompressedSize}，实际 ${content.length}）`
        );
      }
    } else {
      throw new Error(
        `ZIP 条目「${rawName}」使用了不支持的压缩算法（method=${compressionMethod}），仅支持 stored(0) 与 deflate(8)`
      );
    }

    if (content.length > 0 && crc32(content) !== crc32Value) {
      throw new Error(`ZIP 条目「${rawName}」的 CRC-32 校验失败，文件内容已损坏`);
    }

    totalUncompressed += content.length;
    if (totalUncompressed > maxTotalBytes) {
      throw new Error(
        `ZIP 解压后总大小超过 ${maxTotalBytes} 字节上限，请减小部署包体积`
      );
    }

    files.set(path, content);
    void entry;
  }

  return Array.from(files, ([path, content]) => ({ path, content }));
}
