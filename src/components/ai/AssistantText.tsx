import React from 'react';
import {assistantInline} from '../../utils/assistantFormatting';
function Inline({text}:{text:string}) {
  return <>{assistantInline(text).map((part,i)=>part.type==='bold'?<strong key={i}>{part.text}</strong>:part.type==='link'?<a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="underline text-emerald-300">{part.text}</a>:<React.Fragment key={i}>{part.text}</React.Fragment>)}</>;
}
/** Small text-only formatter. HTML, scripts and embedded images never become markup. Numbered steps keep their numbers. */
export function AssistantText({text}:{text:string}) {
  type Kind='p'|'ul'|'ol';
  const marker:Record<Exclude<Kind,'p'>,RegExp>={ul:/^\s*[-*•]\s+/,ol:/^\s*\d{1,2}[.)]\s+/};
  const groups:Array<{kind:Kind;lines:string[];start?:number}>=[];
  for(const line of text.split('\n')) {
    if(!line.trim()){groups.push({kind:'p',lines:[]});continue;}
    const kind:Kind=marker.ul.test(line)?'ul':marker.ol.test(line)?'ol':'p';const previous=groups.at(-1);
    const content=kind==='p'?line:line.replace(marker[kind],'');
    if(previous&&previous.kind===kind&&previous.lines.length)previous.lines.push(content);
    else groups.push({kind,lines:[content],...(kind==='ol'?{start:parseInt(line,10)}:{})});
  }
  return <div className="space-y-2 leading-relaxed break-words">{groups.filter(g=>g.lines.length).map((group,i)=>group.kind==='ul'?<ul key={i} className="list-disc pl-5 space-y-1">{group.lines.map((line,j)=><li key={j}><Inline text={line}/></li>)}</ul>:group.kind==='ol'?<ol key={i} start={group.start&&group.start>1?group.start:undefined} className="list-decimal pl-5 space-y-1 marker:text-emerald-300">{group.lines.map((line,j)=><li key={j}><Inline text={line}/></li>)}</ol>:<p key={i} className="whitespace-pre-line"><Inline text={group.lines.join('\n')}/></p>)}</div>;
}
