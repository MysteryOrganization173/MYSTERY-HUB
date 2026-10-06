import React from 'react';
import {assistantInline} from '../../utils/assistantFormatting';
function Inline({text}:{text:string}) {
  return <>{assistantInline(text).map((part,i)=>part.type==='bold'?<strong key={i}>{part.text}</strong>:part.type==='link'?<a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="underline text-emerald-300">{part.text}</a>:<React.Fragment key={i}>{part.text}</React.Fragment>)}</>;
}
/** Small text-only formatter. HTML, scripts and embedded images never become markup. */
export function AssistantText({text}:{text:string}) {
  const groups:Array<{list:boolean;lines:string[]}>=[];
  for(const line of text.split('\n')) {
    if(!line.trim()){groups.push({list:false,lines:[]});continue;}
    const list=/^\s*[-*]\s+/.test(line);const previous=groups.at(-1);
    if(previous&&previous.list===list&&previous.lines.length)previous.lines.push(list?line.replace(/^\s*[-*]\s+/,''):line);
    else groups.push({list,lines:[list?line.replace(/^\s*[-*]\s+/,''):line]});
  }
  return <div className="space-y-2 leading-relaxed break-words">{groups.filter(g=>g.lines.length).map((group,i)=>group.list?<ul key={i} className="list-disc pl-5 space-y-1">{group.lines.map((line,j)=><li key={j}><Inline text={line}/></li>)}</ul>:<p key={i} className="whitespace-pre-line"><Inline text={group.lines.join('\n')}/></p>)}</div>;
}
