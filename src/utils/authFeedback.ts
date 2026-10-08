export interface FeedbackMessage {id:string;message:string;type:'success'|'info'|'warning';key?:string;}
/** Only explicitly related feedback replaces itself. Security/payment warnings stay independent. */
export function appendFeedback(previous:FeedbackMessage[],next:FeedbackMessage) {return [...previous.filter(item=>!next.key||item.key!==next.key),next];}

// A restored/replaced session is not a new interactive sign-in event.
export function shouldNotifyAuthTransition(previousToken: string | null, token: string, interactive = true) {
  return interactive && previousToken !== token;
}
