// ZIP SUPPORT — binary format plumbing, separate from label logic
// u16/u32 read little-endian numbers; put16/put32 write them
// CRC-32 is the ZIP checksum used to detect damaged entries
// supports ordinary stored/deflated ZIPs, not ZIP64 or encryption
// output is an uncompressed ZIP: a bit larger but still a regular PEMX container
// this file records layouts and byte offsets that come from the official
// PKWARE ZIP File Format Specification
// should go without saying but...
// -------------------- DO NOT TOUCH THIS FILE --------------------

// convert text and filenames between strings and raw UTF-8 bytes
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

// signatures identifying the main ZIP sections
// these appear as PK followed by a record type when viewed as raw bytes
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const END_DIRECTORY_SIGNATURE = 0x06054b50;

// compression methods supported by this reader
// stored means uncompressed while deflate is standard ZIP compression
const STORED_COMPRESSION = 0;
const DEFLATE_COMPRESSION = 8;

// fixed ZIP format values (PKWARE)
const ZIP_VERSION = 20;
const UTF8_FLAG = 0x0800;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_DIRECTORY_SIZE = 22;
const MAX_COMMENT_SIZE = 65535;

// read a 16-bit little-endian number
function u16 (data, position) {
  // ZIP stores the least-significant byte first
  const byte0 = data[position];
  const byte1 = data[position + 1] << 8;

  // combine both bytes into one number
  return byte0 | byte1;
}

// read a 32-bit little-endian number
function u32 (data, position) {
  // shift each byte into its correct position
  const byte0 = data[position];
  const byte1 = data[position + 1] << 8;
  const byte2 = data[position + 2] << 16;
  const byte3 = data[position + 3] << 24;

  // >>> 0 converts the result into an unsigned 32-bit number
  return (byte0 | byte1 | byte2 | byte3) >>> 0;
}

// write a 16-bit little-endian number
function put16 (output, value) {
  // write the lowest byte first followed by the upper byte
  output.push(value & 0xff);
  output.push((value >>> 8) & 0xff);
}

// write a 32-bit little-endian number
function put32 (output, value) {
  // split the number into four individual bytes
  output.push(value & 0xff);
  output.push((value >>> 8) & 0xff);
  output.push((value >>> 16) & 0xff);
  output.push((value >>> 24) & 0xff);
}

// decompress one deflated ZIP entry
async function inflateRaw (bytes) {
  // decompression is provided directly by current Chromium browsers
  if (!('DecompressionStream' in window)) {
    throw new Error('This browser is too old to read compressed PEMX files. Use a current Edge or Chrome.');
  }

  // convert the byte array into a readable browser stream
  const compressedBlob = new Blob([bytes]);
  const compressedStream = compressedBlob.stream();

  // pass the compressed stream through the deflate decompressor
  const decompressor = new DecompressionStream('deflate-raw');
  const decompressedStream = compressedStream.pipeThrough(decompressor);

  // collect the decompressed stream back into a byte array
  const response = new Response(decompressedStream);
  const decompressedBuffer = await response.arrayBuffer();

  return new Uint8Array(decompressedBuffer);
}

// locate the ZIP directory at the end of the file
function findEndDirectory (data) {
  // a valid ZIP cannot be smaller than its required end record
  if (data.length < END_DIRECTORY_SIZE) {
    return -1;
  }

  const lastPosition = data.length - END_DIRECTORY_SIZE;
  let firstPosition = lastPosition - MAX_COMMENT_SIZE;

  // prevent the search from moving before the start of the file
  if (firstPosition < 0) {
    firstPosition = 0;
  }

  // search backwards because the directory is stored near the end
  for (let position = lastPosition; position >= firstPosition; position--) {
    const signature = u32(data, position);

    if (signature === END_DIRECTORY_SIGNATURE) {
      return position;
    }
  }

  // returning -1 indicates that the signature was not found
  return -1;
}

// read all files stored inside a ZIP or PEMX
async function readZip (file) {
  // read the file as a uint8 array and find the end signature
  const fileBuffer = await file.arrayBuffer();
  const data = new Uint8Array(fileBuffer);
  const endDirectory = findEndDirectory(data);

  // if JS finds no end directory, file is likely invalid
  if (endDirectory < 0) {
    throw new Error('The PEMX is not a valid ZIP archive.');
  }

  // the end record identifies how many files exist and where their directory starts
  const entryCount = u16(data, endDirectory + 10);
  const centralDirectoryOffset = u32(data, endDirectory + 16);

  // store every extracted file using its filename as the key
  const entries = new Map();

  // begin reading at the first central-directory entry
  let position = centralDirectoryOffset;

  // read each entry listed in the central directory
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex++) {
    const signature = u32(data, position);

    // every directory entry must begin with the expected signature
    if (signature !== CENTRAL_FILE_SIGNATURE) {
      throw new Error('The PEMX ZIP directory is invalid.');
    }

    // read the fixed fields from the central-directory header
    const compressionMethod = u16(data, position + 10);
    const compressedSize = u32(data, position + 20);
    const nameLength = u16(data, position + 28);
    const extraLength = u16(data, position + 30);
    const commentLength = u16(data, position + 32);
    const localHeaderOffset = u32(data, position + 42);

    // the filename begins immediately after the fixed-size header
    const nameStart = position + CENTRAL_HEADER_SIZE;
    const nameEnd = nameStart + nameLength;
    const nameBytes = data.slice(nameStart, nameEnd);
    const name = decoder.decode(nameBytes);

    // use the saved offset to locate the file's local header
    const localSignature = u32(data, localHeaderOffset);

    if (localSignature !== LOCAL_FILE_SIGNATURE) {
      throw new Error('The PEMX contains an invalid ZIP entry.');
    }

    // local headers can also contain variable-length names and extra data
    const localNameLength = u16(data, localHeaderOffset + 26);
    const localExtraLength = u16(data, localHeaderOffset + 28);

    // skip the header, filename and extra fields to reach the actual file data
    const contentStart = localHeaderOffset + LOCAL_HEADER_SIZE + localNameLength + localExtraLength;
    const contentEnd = contentStart + compressedSize;
    const compressedContent = data.slice(contentStart, contentEnd);

    let content;

    // stored entries do not require decompression
    if (compressionMethod === STORED_COMPRESSION) {
      content = compressedContent;

      // deflated entries must be decompressed
    } else if (compressionMethod === DEFLATE_COMPRESSION) {
      content = await inflateRaw(compressedContent);

      // other compression methods are not supported
    } else {
      throw new Error(`Unsupported compression method ${compressionMethod} in ${name}.`);
    }

    // store the finished file as filename -> byte array
    entries.set(name, content);

    // move past this directory entry and its variable-length fields
    position += CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
  }

  return entries;
}

// generate the lookup table used for ZIP checksums
function createCrcTable () {
  const table = new Uint32Array(256);

  // calculate one checksum shortcut for every possible byte value
  for (let n = 0; n < 256; n++) {
    let c = n;

    // process each of the eight bits contained in the byte
    for (let k = 0; k < 8; k++) {
      if ((c & 1) === 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }

    table[n] = c >>> 0;
  }

  return table;
}

// generate the table once and reuse it for every contained file
const crcTable = createCrcTable();

// calculate the ZIP checksum for one file
function crc32 (bytes) {
  // ZIP CRC calculations begin with every bit set to one
  let checksum = 0xffffffff;

  // update the checksum using every byte in the file
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    const tableIndex = (checksum ^ byte) & 0xff;

    checksum = crcTable[tableIndex] ^ (checksum >>> 8);
  }

  // invert the bits and return an unsigned result
  return (checksum ^ 0xffffffff) >>> 0;
}

// create the local header stored before one file
function createLocalHeader (nameLength, checksum, fileSize) {
  const header = [];

  // identify this structure as a local file header
  put32(header, LOCAL_FILE_SIGNATURE);

  // describe the ZIP version, filename encoding and compression method
  put16(header, ZIP_VERSION);
  put16(header, UTF8_FLAG);
  put16(header, STORED_COMPRESSION);

  // modification time and date
  put16(header, 0);
  put16(header, 0);

  // describe the file contents
  put32(header, checksum);
  put32(header, fileSize);
  put32(header, fileSize);
  put16(header, nameLength);

  // extra field length
  put16(header, 0);

  return new Uint8Array(header);
}

// create the central directory entry for one file
function createCentralHeader (nameLength, checksum, fileSize, localHeaderOffset) {
  const header = [];

  // identify this structure as a central-directory entry
  put32(header, CENTRAL_FILE_SIGNATURE);

  // version made by and minimum version required
  put16(header, ZIP_VERSION);
  put16(header, ZIP_VERSION);

  // describe the filename encoding and compression method
  put16(header, UTF8_FLAG);
  put16(header, STORED_COMPRESSION);

  // modification time and date
  put16(header, 0);
  put16(header, 0);

  // describe the file contents
  put32(header, checksum);
  put32(header, fileSize);
  put32(header, fileSize);
  put16(header, nameLength);

  // extra field and comment lengths
  put16(header, 0);
  put16(header, 0);

  // disk number and file attributes
  put16(header, 0);
  put16(header, 0);
  put32(header, 0);

  // point back to this file's local header
  put32(header, localHeaderOffset);

  return new Uint8Array(header);
}

// create the record marking the end of the ZIP directory
function createEndDirectory (entryCount, centralDirectorySize, centralDirectoryOffset) {
  const record = [];

  // identify this structure as the end-of-directory record
  put32(record, END_DIRECTORY_SIGNATURE);

  // current disk and central-directory disk
  put16(record, 0);
  put16(record, 0);

  // store the number of entries on this disk and in the complete ZIP
  put16(record, entryCount);
  put16(record, entryCount);

  // record the size and starting location of the central directory
  put32(record, centralDirectorySize);
  put32(record, centralDirectoryOffset);

  // ZIP comment length
  put16(record, 0);

  return new Uint8Array(record);
}

// package a collection of files into a new ZIP
function createZip (entries) {
  // local parts contain the actual file headers, names and data
  const localParts = [];

  // central parts form the table of contents at the end of the ZIP
  const centralParts = [];

  // track where each local header begins in the finished file
  let localOffset = 0;

  // create the local and central records for every file
  for (let i = 0; i < entries.length; i++) {
    // each entry contains a filename followed by its byte array
    const entry = entries[i];
    const name = entry[0];
    const bytes = entry[1];

    // filenames must be stored as UTF-8 bytes
    const nameBytes = encoder.encode(name);

    // every ZIP entry requires a checksum of its original contents
    const checksum = crc32(bytes);

    const localHeader = createLocalHeader(nameBytes.length, checksum, bytes.length);

    // local file layout is header -> filename -> file data
    localParts.push(localHeader);
    localParts.push(nameBytes);
    localParts.push(bytes);

    // central entries repeat the metadata and point back to the local header
    const centralHeader = createCentralHeader(nameBytes.length, checksum, bytes.length, localOffset);

    centralParts.push(centralHeader);
    centralParts.push(nameBytes);

    // calculate where the next local file header will begin
    localOffset += localHeader.length + nameBytes.length + bytes.length;
  }

  let centralDirectorySize = 0;

  // calculate the total size of the central directory
  for (let i = 0; i < centralParts.length; i++) {
    centralDirectorySize += centralParts[i].length;
  }

  // localOffset is also the location where the central directory begins
  const endDirectory = createEndDirectory(entries.length, centralDirectorySize, localOffset);
  const zipParts = [];

  // place all file data first
  for (let i = 0; i < localParts.length; i++) {
    zipParts.push(localParts[i]);
  }

  // place the central directory after the file data
  for (let i = 0; i < centralParts.length; i++) {
    zipParts.push(centralParts[i]);
  }

  // place the end record last
  zipParts.push(endDirectory);

  // combine every byte-array section into one downloadable binary file
  return new Blob(zipParts, { type: 'application/octet-stream' });
}