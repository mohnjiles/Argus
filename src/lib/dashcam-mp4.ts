/**
 * Tesla Dashcam MP4 Parser
 * Parses MP4 files and extracts SEI metadata from Tesla dashcam footage.
 * Adapted from Tesla's official dashcam-mp4.js implementation.
 */

import type { VideoConfig, VideoFrame, SeiMetadata } from '../types';
import { decodeSeiProtobuf } from './sei-decoder';

interface BoxLocation {
  start: number;
  end: number;
  size: number;
}

export class DashcamMP4 {
  private buffer: ArrayBuffer;
  private view: DataView;
  private _config: VideoConfig | null = null;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
  }

  // -------------------------------------------------------------
  // MP4 Box Navigation
  // -------------------------------------------------------------

  /** Find a box by name within a range */
  private findBox(start: number, end: number, name: string): BoxLocation {
    for (let pos = start; pos + 8 <= end;) {
      let size = this.view.getUint32(pos);
      const type = this.readAscii(pos + 4, 4);
      const headerSize = size === 1 ? 16 : 8;

      if (size === 1) {
        const high = this.view.getUint32(pos + 8);
        const low = this.view.getUint32(pos + 12);
        size = Number((BigInt(high) << 32n) | BigInt(low));
      } else if (size === 0) {
        size = end - pos;
      }

      if (type === name) {
        return { start: pos + headerSize, end: pos + size, size: size - headerSize };
      }
      pos += size;
    }
    throw new Error(`Box "${name}" not found`);
  }

  /** Find mdat box and return content location */
  private findMdat(): { offset: number; size: number } {
    const mdat = this.findBox(0, this.view.byteLength, 'mdat');
    return { offset: mdat.start, size: mdat.size };
  }

  // -------------------------------------------------------------
  // Video Configuration
  // -------------------------------------------------------------

  /** Get video configuration (lazy-loaded) */
  getConfig(): VideoConfig {
    if (this._config) return this._config;

    const moov = this.findBox(0, this.view.byteLength, 'moov');
    const trak = this.findBox(moov.start, moov.end, 'trak');
    const mdia = this.findBox(trak.start, trak.end, 'mdia');
    const minf = this.findBox(mdia.start, mdia.end, 'minf');
    const stbl = this.findBox(minf.start, minf.end, 'stbl');
    const stsd = this.findBox(stbl.start, stbl.end, 'stsd');
    const avc1 = this.findBox(stsd.start + 8, stsd.end, 'avc1');
    const avcC = this.findBox(avc1.start + 78, avc1.end, 'avcC');

    const o = avcC.start;
    const codec = `avc1.${this.hex(this.view.getUint8(o + 1))}${this.hex(this.view.getUint8(o + 2))}${this.hex(this.view.getUint8(o + 3))}`;

    // Extract SPS/PPS
    let p = o + 6;
    const spsLen = this.view.getUint16(p);
    const sps = new Uint8Array(this.buffer.slice(p + 2, p + 2 + spsLen));
    p += 2 + spsLen + 1;
    const ppsLen = this.view.getUint16(p);
    const pps = new Uint8Array(this.buffer.slice(p + 2, p + 2 + ppsLen));

    // Get timescale from mdhd (ticks per second, used to convert stts deltas to ms)
    const mdhd = this.findBox(mdia.start, mdia.end, 'mdhd');
    const mdhdVersion = this.view.getUint8(mdhd.start);
    const timescale = mdhdVersion === 1
      ? this.view.getUint32(mdhd.start + 20)
      : this.view.getUint32(mdhd.start + 12);

    // Get frame durations from stts (delta ticks per frame -> converted to ms)
    const stts = this.findBox(stbl.start, stbl.end, 'stts');
    const entryCount = this.view.getUint32(stts.start + 4);
    const durations: number[] = [];
    let pos = stts.start + 8;
    for (let i = 0; i < entryCount; i++) {
      const count = this.view.getUint32(pos);
      const delta = this.view.getUint32(pos + 4);
      const ms = (delta / timescale) * 1000;
      for (let j = 0; j < count; j++) durations.push(ms);
      pos += 8;
    }

    this._config = {
      width: this.view.getUint16(avc1.start + 24),
      height: this.view.getUint16(avc1.start + 26),
      codec,
      sps,
      pps,
      timescale,
      durations
    };
    return this._config;
  }

  /** Get total duration in seconds */
  getDuration(): number {
    const config = this.getConfig();
    return config.durations.reduce((sum, d) => sum + d, 0) / 1000;
  }

  /** Get frame count */
  getFrameCount(): number {
    return this.getConfig().durations.length;
  }

  // -------------------------------------------------------------
  // Frame Parsing (for Video Playback)
  // -------------------------------------------------------------

  /** Parse video frames with SEI metadata */
  parseFrames(): VideoFrame[] {
    const config = this.getConfig();
    const mdat = this.findMdat();
    const frames: VideoFrame[] = [];
    let cursor = mdat.offset;
    const end = mdat.offset + mdat.size;
    let pendingSei: SeiMetadata | null = null;
    let currentSps = config.sps;
    let currentPps = config.pps;

    while (cursor + 4 <= end) {
      const len = this.view.getUint32(cursor);
      cursor += 4;
      if (len < 1 || cursor + len > this.view.byteLength) break;

      const type = this.view.getUint8(cursor) & 0x1F;
      const data = new Uint8Array(this.buffer.slice(cursor, cursor + len));

      if (type === 7) {
        currentSps = data; // SPS
      } else if (type === 8) {
        currentPps = data; // PPS
      } else if (type === 6) {
        pendingSei = this.decodeSei(data); // SEI
      } else if (type === 5 || type === 1) {
        // IDR (keyframe) or Slice (non-keyframe)
        frames.push({
          index: frames.length,
          keyframe: type === 5,
          data,
          sei: pendingSei,
          sps: currentSps,
          pps: currentPps
        });
        pendingSei = null;
      }
      cursor += len;
    }
    return frames;
  }

  // -------------------------------------------------------------
  // SEI Extraction
  // -------------------------------------------------------------

  /** Extract all SEI messages for export/analysis */
  extractSeiMessages(): SeiMetadata[] {
    const mdat = this.findMdat();
    const messages: SeiMetadata[] = [];
    let cursor = mdat.offset;
    const end = mdat.offset + mdat.size;

    while (cursor + 4 <= end) {
      const nalSize = this.view.getUint32(cursor);
      cursor += 4;

      if (nalSize < 2 || cursor + nalSize > this.view.byteLength) {
        cursor += Math.max(nalSize, 0);
        continue;
      }

      // NAL type 6 = SEI, payload type 5 = user data unregistered
      if ((this.view.getUint8(cursor) & 0x1F) === 6 && this.view.getUint8(cursor + 1) === 5) {
        const sei = this.decodeSei(new Uint8Array(this.buffer.slice(cursor, cursor + nalSize)));
        if (sei) messages.push(sei);
      }
      cursor += nalSize;
    }
    return messages;
  }

  /** Decode SEI NAL unit to protobuf message */
  private decodeSei(nal: Uint8Array): SeiMetadata | null {
    if (nal.length < 4) return null;

    let i = 3;
    while (i < nal.length && nal[i] === 0x42) i++;
    if (i <= 3 || i + 1 >= nal.length || nal[i] !== 0x69) return null;

    try {
      const stripped = this.stripEmulationBytes(nal.subarray(i + 1, nal.length - 1));
      return decodeSeiProtobuf(stripped);
    } catch {
      return null;
    }
  }

  /** Strip H.264 emulation prevention bytes */
  private stripEmulationBytes(data: Uint8Array): Uint8Array {
    const out: number[] = [];
    let zeros = 0;
    for (const byte of data) {
      if (zeros >= 2 && byte === 0x03) {
        zeros = 0;
        continue;
      }
      out.push(byte);
      zeros = byte === 0 ? zeros + 1 : 0;
    }
    return Uint8Array.from(out);
  }

  // -------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------

  private readAscii(start: number, len: number): string {
    let s = '';
    for (let i = 0; i < len; i++) {
      s += String.fromCharCode(this.view.getUint8(start + i));
    }
    return s;
  }

  private hex(n: number): string {
    return n.toString(16).padStart(2, '0');
  }

  /** Concatenate Uint8Arrays */
  static concat(...arrays: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  /** Create an EncodedVideoChunk for WebCodecs */
  static createVideoChunk(frame: VideoFrame, config: VideoConfig, timestamp?: number): EncodedVideoChunk {
    const sc = new Uint8Array([0, 0, 0, 1]);
    const data = frame.keyframe
      ? DashcamMP4.concat(sc, frame.sps || config.sps, sc, frame.pps || config.pps, sc, frame.data)
      : DashcamMP4.concat(sc, frame.data);
    
    return new EncodedVideoChunk({
      type: frame.keyframe ? 'key' : 'delta',
      timestamp: timestamp ?? (frame.index * 33333), // microseconds (fallback ~30fps)
      data
    });
  }
}

