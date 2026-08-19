async function q(){return window.initSqlJs?window.initSqlJs:new Promise((a,s)=>{const e=document.createElement("script");e.src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js",e.onload=()=>a(window.initSqlJs),e.onerror=()=>s(new Error("Falha ao carregar sql.js")),document.head.appendChild(e)})}async function g(a){return new Promise((s,e)=>{const n=new FileReader;n.onload=async u=>{try{const i=new Uint8Array(u.target?.result),p=await(await q())({locateFile:r=>`https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${r}`}),d=new p.Database(i),m=`
          SELECT 
            f.title as podcast_title, 
            f.image_url as poster_url, 
            i.title as episode_title, 
            m.duration, 
            m.position, 
            m.has_been_played 
          FROM FeedItems i
          JOIN Feeds f ON i.feed = f.id
          JOIN FeedMedia m ON i.id = m.feeditem
          WHERE m.has_been_played = 1 OR m.position > 0
        `;let o;try{o=d.exec(m)}catch{return e("O arquivo não parece ser um banco de dados válido do AntennaPod.")}if(o.length===0)return d.close(),s([]);const w=o[0].columns,f=o[0].values.map(r=>{const t=w.reduce((c,h,y)=>(c[h]=r[y],c),{}),l=t.has_been_played===1,_=t.duration>0?Math.floor(t.position/t.duration*100):0;return{id:`antennapod_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,type:"podcast",status:l?"completed":"watching",title:`${t.podcast_title} - ${t.episode_title}`,posterUrl:t.poster_url,progress:l?100:_,addedAt:Date.now(),source:"antennapod"}});d.close(),s(f)}catch(i){e(i)}},n.onerror=()=>e(n.error),n.readAsArrayBuffer(a)})}export{g as parseAntennaPodDB};
