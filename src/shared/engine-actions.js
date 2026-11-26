// earlier engine crop/garden gameplay has been retired from Temple.
// The central WRITE message-tree uses Temple's separate 'plant' action
// and persists in world.plants; it is deliberately unaffected.
export const ORIGINAL_ACTIONS=new Set();
export function originalView(){return {};}
export function originalAction(){return {error:'Garden gameplay was removed'};}
