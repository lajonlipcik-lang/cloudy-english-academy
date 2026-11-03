/* Cloudy English speech matching utilities. Kept separate from app state. */
(function (global) {
  "use strict";

  function normalizeSpeechText(value){
   return String(value||"").normalize("NFKD").toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
  }
  function speechDistance(a,b){
   const prev=Array.from({length:b.length+1},(_,i)=>i);
   for(let i=1;i<=a.length;i++){let diagonal=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const above=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=above;}}
   return prev[b.length];
  }
  function speechMatches(transcript,target){
   const heard=normalizeSpeechText(transcript),expected=normalizeSpeechText(target);
   if(!heard||!expected)return false;
   // Short English words often differ by a single phoneme (son/sun, ship/sheep).
   // Browser ASR's fuzzy transcript matching cannot safely distinguish them.
   if(heard===expected)return true;
   if(expected.includes(" "))return false;
   if(expected.length<5)return false;
   return Math.abs(heard.length-expected.length)<=1&&speechDistance(heard,expected)<=1;
  }

  global.CloudySpeech = Object.freeze({ normalizeSpeechText, speechDistance, speechMatches });
})(window);
