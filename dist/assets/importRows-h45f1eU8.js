<<<<<<<< HEAD:dist/assets/importRows-DpbyFBie.js
import{vt as e}from"./index-DWP2Znh5.js";var t=async({rows:t=[],endpoint:n,key:r,mapRow:i})=>{let a=[];for(let o of t){let t=i(o),s=t?.[r];if(s)try{a.push(await e.put(`${n}/${encodeURIComponent(s)}`,t))}catch(r){if(r.status!==404)throw r;a.push(await e.post(n,t))}}return a},n=(e,t,n=``)=>{for(let n of t){let t=e?.[n];if(t!=null&&String(t).trim()!==``)return t}return n};export{t as n,n as t};
========
import{xt as e}from"./index-DoHbhiik.js";var t=async({rows:t=[],endpoint:n,key:r,mapRow:i})=>{let a=[];for(let o of t){let t=i(o),s=t?.[r];if(s)try{a.push(await e.put(`${n}/${encodeURIComponent(s)}`,t))}catch(r){if(r.status!==404)throw r;a.push(await e.post(n,t))}}return a},n=(e,t,n=``)=>{for(let n of t){let t=e?.[n];if(t!=null&&String(t).trim()!==``)return t}return n};export{t as n,n as t};
>>>>>>>> d957380947340ef8b9c4a771e325acf770b7c470:dist/assets/importRows-h45f1eU8.js
