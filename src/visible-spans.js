// The packed buffer contains immutable, ordered source spans. Copy only the
// suffix that differs from its previous layout, preserving all existing indices.
export function repackVisibleSpans(attribute,previous,next){
 let start=0,i=0;
 while(i<previous.length&&i<next.length&&previous[i]===next[i])start+=next[i++].length;
 let end=start;for(;i<next.length;i++){attribute.array.set(next[i],end);end+=next[i].length;}
 if(end>start){
  let low=start,high=end;
  // A second update before rendering must not discard the first pending upload.
  for(const r of attribute.updateRanges||[]){low=Math.min(low,r.start);high=Math.max(high,r.start+r.count);}
  attribute.clearUpdateRanges();attribute.addUpdateRange(low,high-low);attribute.needsUpdate=true;
 }
 return end;
}
