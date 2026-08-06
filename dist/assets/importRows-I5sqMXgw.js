<<<<<<< HEAD:dist/assets/importRows-I5sqMXgw.js
import{mt as e}from"./index-BP0L4qeI.js";var t=async({rows:t=[],endpoint:n,key:r,mapRow:i})=>{let a=[];for(let o of t){let t=i(o),s=t?.[r];if(s)try{a.push(await e.put(`${n}/${encodeURIComponent(s)}`,t))}catch(r){if(r.status!==404)throw r;a.push(await e.post(n,t))}}return a},n=(e,t,n=``)=>{for(let n of t){let t=e?.[n];if(t!=null&&String(t).trim()!==``)return t}return n};export{t as n,n as t};
=======
<<<<<<<< HEAD:dist/assets/importRows-CxMzHwHU.js
import{vt as e}from"./index--iSTimHZ.js";var t=async({rows:t=[],endpoint:n,key:r,mapRow:i})=>{let a=[];for(let o of t){let t=i(o),s=t?.[r];if(s)try{a.push(await e.put(`${n}/${encodeURIComponent(s)}`,t))}catch(r){if(r.status!==404)throw r;a.push(await e.post(n,t))}}return a},n=(e,t,n=``)=>{for(let n of t){let t=e?.[n];if(t!=null&&String(t).trim()!==``)return t}return n};export{t as n,n as t};
========
import{mt as e}from"./index-t0ypllMT.js";var t=async({rows:t=[],endpoint:n,key:r,mapRow:i})=>{let a=[];for(let o of t){let t=i(o),s=t?.[r];if(s)try{a.push(await e.put(`${n}/${encodeURIComponent(s)}`,t))}catch(r){if(r.status!==404)throw r;a.push(await e.post(n,t))}}return a},n=(e,t,n=``)=>{for(let n of t){let t=e?.[n];if(t!=null&&String(t).trim()!==``)return t}return n};export{t as n,n as t};
>>>>>>>> d2e7bff1e758d984014269be7f9c08eefae2b024:dist/assets/importRows-BWPup8yl.js
>>>>>>> 88a983b685086cc52705353286b65c8ba8b867b6:dist/assets/importRows-BWPup8yl.js
