// Values taken from the official 00GameDevs Energy Sword Wave export.
// Both the authoritative hit crest and visual module use this same timeline.
export const SABER_WAVE_COUNT=5;
export const SABER_WAVE_FAN_ANGLE_DEG=60;
export const SABER_WAVE_DURATION_MS=1550;
export function saberWaveCrest(range,progress){
 const p=Math.max(0,Math.min(1,Number(progress)||0));
 const bladeP=Math.min(p/.86,1);
 return Math.max(0,Number(range)||0)*(1-Math.pow(1-bladeP,1.52));
}
