export type AssistantInline = {type:'text'|'bold'|'link';text:string;href?:string};
export function safeAssistantHref(value:string):string|null {
  if (/\s|[<>\\]/.test(value)) return null;
  if (value.startsWith('/')&&!value.startsWith('//')) return value;
  try { const url=new URL(value); return url.protocol==='https:'&&!url.username&&!url.password?url.href:null; } catch {return null;}
}
export function assistantInline(text:string):AssistantInline[] {
  const parts:AssistantInline[]=[];let start=0;
  const pattern=/\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^)\n]+)\)/g;
  for(const match of text.matchAll(pattern)) {
    const offset=match.index!;if(offset>start)parts.push({type:'text',text:text.slice(start,offset)});
    if(match[1])parts.push({type:'bold',text:match[1]});
    else {const href=safeAssistantHref(match[3]);parts.push(href?{type:'link',text:match[2],href}:{type:'text',text:match[0]});}
    start=offset+match[0].length;
  }
  if(start<text.length)parts.push({type:'text',text:text.slice(start)});
  return parts;
}
