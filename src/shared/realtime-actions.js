// Only these small authenticated gameplay mutations may use compact realtime
// receipts. Commerce, GM, media and payment remain on their existing APIs.
const HOT_ACTIONS=new Set(['attack','equip','unequip','inspect-item','pickup-coin','pickup-drop','pickup-artwork','use-consumable','assign-consumable']);
export const isRealtimeAction=action=>HOT_ACTIONS.has(action);
