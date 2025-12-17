/**
 * SEI Metadata Decoder
 * Decodes protobuf-encoded SEI data from Tesla dashcam videos.
 */

import type { SeiMetadata } from '../types';
import { GearState, AutopilotState } from '../types';

// Protobuf wire types
const WIRE_VARINT = 0;
const WIRE_64BIT = 1;
const WIRE_LENGTH_DELIMITED = 2;
const WIRE_32BIT = 5;

/**
 * Simple protobuf decoder for SeiMetadata
 * Field numbers match dashcam.proto:
 * 1: version (uint32)
 * 2: gear_state (enum)
 * 3: frame_seq_no (uint64)
 * 4: vehicle_speed_mps (float)
 * 5: accelerator_pedal_position (float)
 * 6: steering_wheel_angle (float)
 * 7: blinker_on_left (bool)
 * 8: blinker_on_right (bool)
 * 9: brake_applied (bool)
 * 10: autopilot_state (enum)
 * 11: latitude_deg (double)
 * 12: longitude_deg (double)
 * 13: heading_deg (double)
 * 14: linear_acceleration_mps2_x (double)
 * 15: linear_acceleration_mps2_y (double)
 * 16: linear_acceleration_mps2_z (double)
 */
export function decodeSeiProtobuf(data: Uint8Array): SeiMetadata | null {
  if (!data || data.length === 0) return null;

  const result: SeiMetadata = {
    version: 0,
    gearState: GearState.GEAR_PARK,
    frameSeqNo: BigInt(0),
    vehicleSpeedMps: 0,
    acceleratorPedalPosition: 0,
    steeringWheelAngle: 0,
    blinkerOnLeft: false,
    blinkerOnRight: false,
    brakeApplied: false,
    autopilotState: AutopilotState.NONE,
    latitudeDeg: 0,
    longitudeDeg: 0,
    headingDeg: 0,
    linearAccelerationMps2X: 0,
    linearAccelerationMps2Y: 0,
    linearAccelerationMps2Z: 0,
  };

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  try {
    while (offset < data.length) {
      const tag = readVarint(data, offset);
      offset = tag.newOffset;
      
      const fieldNumber = Number(tag.value >> 3n);
      const wireType = Number(tag.value & 0x7n);

      switch (fieldNumber) {
        case 1: // version
          if (wireType === WIRE_VARINT) {
            const v = readVarint(data, offset);
            result.version = Number(v.value);
            offset = v.newOffset;
          }
          break;

        case 2: // gear_state
          if (wireType === WIRE_VARINT) {
            const v = readVarint(data, offset);
            result.gearState = Number(v.value) as GearState;
            offset = v.newOffset;
          }
          break;

        case 3: // frame_seq_no
          if (wireType === WIRE_VARINT) {
            const v = readVarint(data, offset);
            result.frameSeqNo = v.value;
            offset = v.newOffset;
          }
          break;

        case 4: // vehicle_speed_mps
          if (wireType === WIRE_32BIT) {
            result.vehicleSpeedMps = view.getFloat32(offset, true);
            offset += 4;
          }
          break;

        case 5: // accelerator_pedal_position
          if (wireType === WIRE_32BIT) {
            result.acceleratorPedalPosition = view.getFloat32(offset, true);
            offset += 4;
          }
          break;

        case 6: // steering_wheel_angle
          if (wireType === WIRE_32BIT) {
            result.steeringWheelAngle = view.getFloat32(offset, true);
            offset += 4;
          }
          break;

        case 7: // blinker_on_left
          if (wireType === WIRE_VARINT) {
            const v = readVarint(data, offset);
            result.blinkerOnLeft = v.value !== BigInt(0);
            offset = v.newOffset;
          }
          break;

        case 8: // blinker_on_right
          if (wireType === WIRE_VARINT) {
            const v = readVarint(data, offset);
            result.blinkerOnRight = v.value !== BigInt(0);
            offset = v.newOffset;
          }
          break;

        case 9: // brake_applied
          if (wireType === WIRE_VARINT) {
            const v = readVarint(data, offset);
            result.brakeApplied = v.value !== BigInt(0);
            offset = v.newOffset;
          }
          break;

        case 10: // autopilot_state
          if (wireType === WIRE_VARINT) {
            const v = readVarint(data, offset);
            result.autopilotState = Number(v.value) as AutopilotState;
            offset = v.newOffset;
          }
          break;

        case 11: // latitude_deg
          if (wireType === WIRE_64BIT) {
            result.latitudeDeg = view.getFloat64(offset, true);
            offset += 8;
          }
          break;

        case 12: // longitude_deg
          if (wireType === WIRE_64BIT) {
            result.longitudeDeg = view.getFloat64(offset, true);
            offset += 8;
          }
          break;

        case 13: // heading_deg
          if (wireType === WIRE_64BIT) {
            result.headingDeg = view.getFloat64(offset, true);
            offset += 8;
          }
          break;

        case 14: // linear_acceleration_mps2_x
          if (wireType === WIRE_64BIT) {
            result.linearAccelerationMps2X = view.getFloat64(offset, true);
            offset += 8;
          }
          break;

        case 15: // linear_acceleration_mps2_y
          if (wireType === WIRE_64BIT) {
            result.linearAccelerationMps2Y = view.getFloat64(offset, true);
            offset += 8;
          }
          break;

        case 16: // linear_acceleration_mps2_z
          if (wireType === WIRE_64BIT) {
            result.linearAccelerationMps2Z = view.getFloat64(offset, true);
            offset += 8;
          }
          break;

        default:
          // Skip unknown fields
          offset = skipField(data, offset, wireType, view);
          break;
      }
    }
  } catch (e) {
    console.warn('Failed to decode SEI protobuf:', e);
    return null;
  }

  return result;
}

// Read a varint from the buffer
function readVarint(data: Uint8Array, offset: number): { value: bigint; newOffset: number } {
  let value = BigInt(0);
  let shift = 0;
  
  while (offset < data.length) {
    const byte = data[offset];
    value |= BigInt(byte & 0x7F) << BigInt(shift);
    offset++;
    
    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7;
  }
  
  return { value, newOffset: offset };
}

// Skip a field based on wire type
function skipField(data: Uint8Array, offset: number, wireType: number, _view: DataView): number {
  switch (wireType) {
    case WIRE_VARINT: {
      const v = readVarint(data, offset);
      return v.newOffset;
    }
    case WIRE_64BIT:
      return offset + 8;
    case WIRE_LENGTH_DELIMITED: {
      const len = readVarint(data, offset);
      return len.newOffset + Number(len.value);
    }
    case WIRE_32BIT:
      return offset + 4;
    default:
      throw new Error(`Unknown wire type: ${wireType}`);
  }
}

// Utility to format SEI data for display
export function formatSeiForDisplay(sei: SeiMetadata, speedUnit: 'mph' | 'kph' = 'mph'): Record<string, string> {
  const speed = speedUnit === 'mph' 
    ? sei.vehicleSpeedMps * 2.23694 
    : sei.vehicleSpeedMps * 3.6;

  const gearLabels: Record<GearState, string> = {
    [GearState.GEAR_PARK]: 'P',
    [GearState.GEAR_DRIVE]: 'D',
    [GearState.GEAR_REVERSE]: 'R',
    [GearState.GEAR_NEUTRAL]: 'N',
  };

  const autopilotLabels: Record<AutopilotState, string> = {
    [AutopilotState.NONE]: 'Off',
    [AutopilotState.SELF_DRIVING]: 'FSD',
    [AutopilotState.AUTOSTEER]: 'Autosteer',
    [AutopilotState.TACC]: 'TACC',
  };

  return {
    speed: `${speed.toFixed(1)} ${speedUnit}`,
    gear: gearLabels[sei.gearState] || 'Unknown',
    autopilot: autopilotLabels[sei.autopilotState] || 'Unknown',
    steering: `${sei.steeringWheelAngle.toFixed(1)}°`,
    accelerator: `${sei.acceleratorPedalPosition.toFixed(0)}%`,
    brake: sei.brakeApplied ? 'Applied' : 'Released',
    leftBlinker: sei.blinkerOnLeft ? 'On' : 'Off',
    rightBlinker: sei.blinkerOnRight ? 'On' : 'Off',
    latitude: sei.latitudeDeg.toFixed(6),
    longitude: sei.longitudeDeg.toFixed(6),
    heading: `${sei.headingDeg.toFixed(1)}°`,
  };
}

