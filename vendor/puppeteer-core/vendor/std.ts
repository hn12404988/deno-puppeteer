export {
  decodeBase64 as base64Decode,
  encodeBase64 as base64Encode,
} from "https://deno.land/std@0.224.0/encoding/base64.ts";
export { concat as concatUint8Array } from "https://deno.land/std@0.224.0/bytes/mod.ts";
export {
  join as pathJoin,
  resolve as pathResolve,
} from "https://deno.land/std@0.224.0/path/mod.ts";
// readLines replacement for Deno 2
export async function* readLines(reader: ReadableStream<Uint8Array>): AsyncIterableIterator<string> {
  const textDecoder = new TextDecoderStream();
  const readable = reader.pipeThrough(textDecoder);
  
  let buffer = '';
  const streamReader = readable.getReader();
  
  try {
    while (true) {
      const { done, value } = await streamReader.read();
      if (done) {
        if (buffer.length > 0) {
          yield buffer;
        }
        break;
      }
      
      buffer += value;
      const lines = buffer.split('\n');
      
      // Yield all complete lines
      for (let i = 0; i < lines.length - 1; i++) {
        yield lines[i];
      }
      
      // Keep the last line (might be incomplete)
      buffer = lines[lines.length - 1];
    }
  } finally {
    streamReader.releaseLock();
  }
}
export { exists, existsSync } from "https://deno.land/std@0.224.0/fs/exists.ts";
export { copy as copyDir } from "https://deno.land/std@0.224.0/fs/copy.ts";
export { sprintf } from "https://deno.land/std@0.224.0/fmt/printf.ts";
