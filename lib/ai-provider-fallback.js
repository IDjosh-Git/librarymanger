'use strict';
// Server-only provider orchestration for AI chat metadata and image suggestions.
// Never copy keys into browser JavaScript. Free services require their own keys/quotas.
function available(){
 return [process.env.GEMINI_API_KEY&&'gemini',process.env.OPENROUTER_API_KEY&&'openrouter',process.env.GROQ_API_KEY&&'groq'].filter(Boolean);
}
function statusError(provider,status){return Object.assign(new Error(provider+' '+status),{status})}
function safeJSON(content){
 const str=String(content||'').trim().replace(/^```(?:json)?\s*|\s*```$/gi,'').trim();
 try{return JSON.parse(str)}catch{}
 const left=str.indexOf('{'),right=str.lastIndexOf('}');
 if(left>=0&&right>left)return JSON.parse(str.slice(left,right+1));
 throw new Error('AI provider returned invalid structured metadata');
}
async function compatibleJSON(provider,prompt,{image,signal,maxTokens=550}={}){
 const router=provider==='openrouter';
 const key=router?process.env.OPENROUTER_API_KEY:process.env.GROQ_API_KEY;
 const model=router?'openrouter/free':image?process.env.GROQ_VISION_MODEL||'qwen/qwen3.8-27b':process.env.GROQ_CHAT_MODEL||'llama-3.1-8b-instant';
 const url=router?'https://openrouter.ai/api/v1/chat/completions':'https://api.groq.com/openai/v1/chat/completions';
 const content=image?[{type:'text',text:prompt},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+image}}]:prompt;
 const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,...(router?{'X-Title':'Library Manager'}:{})},body:JSON.stringify({model,messages:[{role:'user',content}],max_tokens:maxTokens,temperature:0,stream:false}),signal});
 if(!res.ok)throw statusError(provider,res.status);
 const result=await res.json(),contentOut=result?.choices?.[0]?.message?.content;
 const message=typeof contentOut==='string'?contentOut:Array.isArray(contentOut)?contentOut.map(p=>p.text||'').join(''):'';
 if(!message)throw new Error(provider+' did not return metadata');
 return {data:safeJSON(message),provider};
}
async function raceProviders(task,{delayMs=1100,timeoutMs=19000}={}){
 const providers=available();if(!providers.length)throw statusError('No configured AI providers',503);
 const controllers=providers.map(()=>new AbortController());let started=0,active=0,finished=false;
 return new Promise((resolve,reject)=>{
  const end=()=>{if(finished)return;finished=true;clearInterval(hedge);controllers.forEach(c=>c.abort())};
  const launch=()=>{
   if(finished||started>=providers.length)return;
   const index=started++,provider=providers[index],controller=controllers[index];active++;
   const deadline=setTimeout(()=>controller.abort(),timeoutMs);
   Promise.resolve().then(()=>task(provider,controller.signal)).then(value=>{
    clearTimeout(deadline);active--;
    if(!finished){end();resolve({...value,provider:value?.provider||provider})}
   },err=>{
    clearTimeout(deadline);active--;
    if(finished)return;
    launch();
    if(started===providers.length&&active===0){end();reject(err)}
   });
  };
  const hedge=setInterval(()=>{if(!finished&&started<providers.length)launch()},delayMs);
  launch();
 });
}
module.exports={available,raceProviders,compatibleJSON,safeJSON,statusError};
